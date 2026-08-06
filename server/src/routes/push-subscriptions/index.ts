import { Router, Request, Response } from 'express';
import { AppError } from '../../middleware/error.js';
import { adminClient } from '../../lib/supabase-admin.js';

export const pushSubscriptionsRouter: Router = Router();

// GET /push-subscriptions — list current user's subscriptions
pushSubscriptionsRouter.get('/', async (req: Request, res: Response) => {
  const { data, error } = await adminClient
    .from('push_subscriptions')
    .select('id, user_agent, created_at')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return res.json({ data: [] });
    throw new AppError(500, error.message);
  }
  res.json({ data: data || [] });
});

// POST /push-subscriptions — save new subscription
pushSubscriptionsRouter.post('/', async (req: Request, res: Response) => {
  const { subscription, user_agent } = req.body;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new AppError(400, 'Invalid push subscription object');
  }

  // Upsert: one subscription per endpoint per user
  const { data: existing, error: selectError } = await adminClient
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', req.user!.id)
    .eq('endpoint', subscription.endpoint)
    .maybeSingle();

  if (selectError) {
    if (selectError.code === '42P01') return res.json({ data: null });
    throw new AppError(500, selectError.message);
  }

  if (existing) {
    // Already registered — just update user_agent
    const { error } = await adminClient
      .from('push_subscriptions')
      .update({ user_agent: user_agent || null, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) {
      if (error.code === '42P01') return res.json({ data: { id: existing.id } });
      throw new AppError(500, error.message);
    }
    return res.json({ data: { id: existing.id } });
  }

  const { data, error } = await adminClient
    .from('push_subscriptions')
    .insert({
      user_id: req.user!.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: user_agent || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '42P01') return res.status(201).json({ data: null });
    throw new AppError(500, error.message);
  }
  res.status(201).json({ data });
});

// DELETE /push-subscriptions/:id — remove a subscription
pushSubscriptionsRouter.delete('/:id', async (req: Request, res: Response) => {
  const { error } = await adminClient
    .from('push_subscriptions')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id);

  if (error) {
    if (error.code === '42P01') return res.json({ success: true });
    throw new AppError(500, error.message);
  }
  res.json({ success: true });
});

// DELETE /push-subscriptions — remove all subscriptions for current user
pushSubscriptionsRouter.delete('/', async (req: Request, res: Response) => {
  const { error } = await adminClient
    .from('push_subscriptions')
    .delete()
    .eq('user_id', req.user!.id);

  if (error) {
    if (error.code === '42P01') return res.json({ success: true });
    throw new AppError(500, error.message);
  }
  res.json({ success: true });
});
