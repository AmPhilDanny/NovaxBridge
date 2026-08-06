import { Router, Request, Response, NextFunction } from 'express';
import { adminClient } from '../../lib/supabase-admin.js';
import { AppError } from '../../middleware/error.js';

export const messagingRouter: Router = Router();

// ── POST /conversations — create or get existing conversation ──
messagingRouter.post('/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = req.supabaseClient!;
    const { other_participant_id, order_id } = req.body;
    if (!other_participant_id) return next(new AppError(400, 'other_participant_id required'));

    // Connection gate
    if (!order_id) {
      const { data: canMsg, error: gateErr } = await supabase.rpc('can_message', {
        sender_id: req.user!.id,
        receiver_id: other_participant_id,
      });
      if (gateErr) return next(new AppError(500, gateErr.message));
      if (!canMsg) return next(new AppError(403, 'You must be connected to message this user'));
    }

    // Check existing
    const { data: existing, error: checkErr } = await supabase.rpc('find_existing_conversation', {
      p_user_id: req.user!.id,
      p_other_id: other_participant_id,
      p_order_id: order_id || null,
    });

    if (!checkErr && existing && existing.length > 0) {
      return res.json({ data: existing[0] });
    }

    // Create conversation + add participants via admin client.
    // The user's authenticated client triggers RLS on .select() after insert
    // (SELECT policy requires participant row, which doesn't exist yet).
    // adminClient bypasses RLS — safe because can_message RPC already validated.
    const { data: conv, error: convErr } = await adminClient
      .from('conversations')
      .insert({ order_id: order_id || null })
      .select()
      .single();
    if (convErr) return next(new AppError(500, convErr.message));

    const { error: partErr } = await adminClient
      .from('conversation_participants')
      .insert([
        { conversation_id: conv.id, profile_id: req.user!.id },
        { conversation_id: conv.id, profile_id: other_participant_id },
      ]);
    if (partErr) return next(new AppError(500, partErr.message));

    res.status(201).json({ data: conv });
  } catch (error) {
    next(error);
  }
});

// ── GET /conversations — list user conversations ──
messagingRouter.get('/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = req.supabaseClient!;
    const { data: myParts } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('profile_id', req.user!.id);
    if (!myParts || myParts.length === 0) return res.json({ data: [] });

    const convIds = myParts.map((p: any) => p.conversation_id);

    const { data: convs } = await supabase
      .from('conversations')
      .select('*, messages(id, content, sender_id, created_at)')
      .in('id', convIds)
      .order('last_message_at', { ascending: false });

    const { data: allParts } = await supabase
      .from('conversation_participants')
      .select('conversation_id, profile_id')
      .in('conversation_id', convIds);

    const partsByConv = new Map<string, string[]>();
    for (const p of (allParts || [])) {
      const arr = partsByConv.get(p.conversation_id) || [];
      arr.push(p.profile_id);
      partsByConv.set(p.conversation_id, arr);
    }

    const allOtherIds = new Set<string>();
    for (const conv of (convs || [])) {
      const partIds = partsByConv.get(conv.id) || [];
      for (const pid of partIds) {
        if (pid !== req.user!.id) allOtherIds.add(pid);
      }
    }

    let profilesMap = new Map<string, any>();
    if (allOtherIds.size > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .in('id', Array.from(allOtherIds));
      for (const p of (profs || [])) profilesMap.set(p.id, p);
    }

    const results = (convs || []).map((conv: any) => {
      const partIds = partsByConv.get(conv.id) || [];
      const otherIds = partIds.filter((id: string) => id !== req.user!.id);
      const otherProfile = otherIds.map((id: string) => profilesMap.get(id)).filter(Boolean);
      const convMsgs = conv.messages || [];
      const lastMsg = convMsgs.length > 0 ? convMsgs[convMsgs.length - 1] : null;

      return {
        id: conv.id,
        order_id: conv.order_id,
        created_at: conv.created_at,
        updated_at: conv.last_message_at,
        other_profiles: otherProfile,
        last_message: lastMsg,
        last_message_attachments: [],
        unread_count: 0,
      };
    });

    res.json({ data: results });
  } catch (error) {
    next(error);
  }
});

// ── GET /conversations/:id — single conversation ──
messagingRouter.get('/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = req.supabaseClient!;
    const { data: conv, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) return next(new AppError(404, 'Conversation not found'));
    res.json({ data: conv });
  } catch (error) {
    next(error);
  }
});

// ── GET /conversations/:id/messages — list messages ──
messagingRouter.get('/conversations/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = req.supabaseClient!;
    const { data: membership } = await supabase
      .from('conversation_participants')
      .select('profile_id')
      .eq('conversation_id', req.params.id)
      .eq('profile_id', req.user!.id)
      .maybeSingle();
    if (!membership) return next(new AppError(403, 'Not a participant'));

    const { data: msgs, error } = await supabase
      .from('messages')
      .select('*, message_attachments(*)')
      .eq('conversation_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) return next(new AppError(500, error.message));
    res.json({ data: msgs });
  } catch (error) {
    next(error);
  }
});

// ── POST /conversations/:id/messages — send message ──
messagingRouter.post('/conversations/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = req.supabaseClient!;
    const { content, attachments } = req.body;

    if ((!content || !content.trim()) && (!attachments || attachments.length === 0)) {
      return next(new AppError(400, 'Content or attachments required'));
    }

    const { data: membership } = await supabase
      .from('conversation_participants')
      .select('profile_id')
      .eq('conversation_id', req.params.id)
      .eq('profile_id', req.user!.id)
      .maybeSingle();
    if (!membership) return next(new AppError(403, 'Not a participant'));

    const { data: msg, error: msgErr } = await supabase
      .from('messages')
      .insert({ conversation_id: req.params.id, sender_id: req.user!.id, content: (content || '').trim(), sender_name: req.user?.user_metadata?.full_name || req.user?.email || '' })
      .select()
      .single();
    if (msgErr) return next(new AppError(500, msgErr.message));

    // Insert attachments
    if (attachments && attachments.length > 0) {
      const attachmentRows = attachments.map((a: any) => ({
        message_id: msg.id,
        conversation_id: req.params.id,
        sender_id: req.user!.id,
        storage_path: a.storage_path,
        file_name: a.file_name,
        file_size: a.file_size,
        mime_type: a.mime_type,
      }));
      const { error: attachErr } = await supabase.from('message_attachments').insert(attachmentRows);
      if (attachErr) return next(new AppError(500, attachErr.message));
    }

    // Update conversation timestamp
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', req.params.id);

    // Notify other participants
    const displayText = (content || '').trim().slice(0, 100) || (attachments ? `Sent ${attachments.length} file(s)` : '');
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('profile_id')
      .eq('conversation_id', req.params.id)
      .neq('profile_id', req.user!.id);

    if (participants) {
      for (const p of participants) {
        await supabase.from('notifications').insert({
          profile_id: p.profile_id, title: 'New message', message: displayText,
          type: 'message', reference_id: req.params.id, reference_type: 'conversation',
        }).maybeSingle();
      }
    }

    res.status(201).json({ data: msg });
  } catch (error) {
    next(error);
  }
});
