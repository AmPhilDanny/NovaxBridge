import { Router, Request, Response } from 'express';
import { AppError } from '../../middleware/error.js';

export const notificationsRouter: Router = Router();

// ── GET /notifications — list user's notifications ──
notificationsRouter.get('/', async (req: Request, res: Response) => {
  const supabase = req.supabaseClient!;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const unreadOnly = req.query.unread === 'true';

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('profile_id', req.user!.id)
    .order('created_at', { ascending: false });

  if (unreadOnly) query = query.eq('is_read', false);

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ── GET /notifications/unread-count ──
notificationsRouter.get('/unread-count', async (req: Request, res: Response) => {
  const supabase = req.supabaseClient!;
  const { data, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', req.user!.id)
    .eq('is_read', false);
  if (error) throw new AppError(500, error.message);
  res.json({ count: data?.length || 0 });
});

// ── POST /notifications/send — create notification ──
notificationsRouter.post('/send', async (req: Request, res: Response) => {
  const supabase = req.supabaseClient!;
  const { profile_id, title, message, type } = req.body;
  if (!profile_id || !title) {
    throw new AppError(400, 'Missing required fields: profile_id, title');
  }
  const { data, error } = await supabase
    .from('notifications')
    .insert({ profile_id, title, message, type: type || 'general', is_read: false })
    .select()
    .single();
  if (error) throw new AppError(500, error.message);
  res.status(201).json({ data });
});

// ── PATCH /notifications/read-all ──
notificationsRouter.patch('/read-all', async (req: Request, res: Response) => {
  const supabase = req.supabaseClient!;
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('profile_id', req.user!.id)
    .eq('is_read', false);
  if (error) throw new AppError(500, error.message);
  res.json({ ok: true });
});

// ── PATCH /notifications/:id/read — mark single as read ──
notificationsRouter.patch('/:id/read', async (req: Request, res: Response) => {
  const supabase = req.supabaseClient!;
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', req.params.id)
    .eq('profile_id', req.user!.id);
  if (error) throw new AppError(500, error.message);
  res.json({ ok: true });
});
