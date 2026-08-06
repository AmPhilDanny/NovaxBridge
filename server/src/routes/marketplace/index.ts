import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { adminClient } from '../../lib/supabase-admin.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../middleware/error.js';

export const marketplaceRouter: Router = Router();

/**
 * Returns the Supabase client to use for the request.
 * If the user is authenticated (req.supabaseClient is set), uses that.
 * Otherwise falls back to adminClient so unauthenticated users can
 * browse public listings and reviews.
 */
function getDb(req: Request) {
  return req.supabaseClient || adminClient;
}

/**
 * Returns a 401 error if the request has no authenticated user.
 * Call at the top of any route that requires a logged-in user.
 */
function requireUser(req: Request, res: Response): boolean {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }
  return true;
}

// ── Helpers ──

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await adminClient.from('profiles').select('role').eq('id', userId).single();
  return data?.role === 'admin';
}

async function createNotification(
  supabase: any,
  profile_id: string,
  title: string,
  message: string,
  type: 'order' | 'payment' | 'system' | 'promo'
) {
  await supabase.from('notifications').insert({ profile_id, title, message, type }).maybeSingle();
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'disputed'],
  disputed: ['refunded', 'completed'],
  completed: [],
  cancelled: [],
  refunded: [],
};

function canTransition(current: string, next: string): boolean {
  const allowed = VALID_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

// ════════════════════════════════════════
// LISTINGS
// ════════════════════════════════════════

// GET /services — list active services (public)
marketplaceRouter.get('/services', async (req: Request, res: Response) => {
  const supabase = getDb(req);
  const { data, error } = await supabase.from('services').select('*').eq('is_active', true).order('name');
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// GET /listings — list marketplace listings with filters (public)
marketplaceRouter.get('/listings', async (req: Request, res: Response) => {
  const supabase = getDb(req);
  let query = supabase
    .from('marketplace_listings')
    .select(`*, service:services(id, name, slug, category, description), provider:profiles(id, full_name, avatar_url, headline)`, { count: 'exact' });

  const status = req.query.status as string | undefined;
  const category = req.query.category as string | undefined;
  const search = req.query.search as string | undefined;
  const mine = req.query.mine === 'true';
  const minPrice = req.query.min_price as string | undefined;
  const maxPrice = req.query.max_price as string | undefined;
  const sort = (req.query.sort as string) || 'newest';
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = (page - 1) * limit;

  // Only filter by "mine" if user is authenticated
  if (mine && req.user) query = query.eq('provider_id', req.user.id);
  if (status) query = query.eq('status', status);
  if (category) query = query.eq('service.category', category);
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  if (minPrice) query = query.gte('price', parseFloat(minPrice));
  if (maxPrice) query = query.lte('price', parseFloat(maxPrice));

  if (sort === 'price_asc') query = query.order('price', { ascending: true });
  else if (sort === 'price_desc') query = query.order('price', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new AppError(500, error.message);
  res.json({ data, count, page, limit, offset });
});

// GET /listings/:id — single listing detail (public)
marketplaceRouter.get('/listings/:id', async (req: Request, res: Response) => {
  const supabase = getDb(req);
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select('*, service:services(*), provider:profiles(id, full_name, avatar_url, headline, bio)')
    .eq('id', req.params.id)
    .single();
  if (error) throw new AppError(404, 'Listing not found');
  res.json({ data });
});

// POST /listings — create a new listing (auth required)
marketplaceRouter.post('/listings',
  validate(z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    price: z.number().min(0),
    service_id: z.string().min(1),
    duration_hours: z.number().min(1),
  })),
  async (req: Request, res: Response) => {
    if (!requireUser(req, res)) return;
    const supabase = getDb(req);
    const { title, description, price, service_id, duration_hours } = req.body;

    const { data, error } = await supabase
      .from('marketplace_listings')
      .insert({ title, description, price, service_id, duration_hours, provider_id: req.user!.id, status: 'active' })
      .select()
      .single();
    if (error) throw new AppError(500, error.message);
    res.status(201).json({ data });
  }
);

// PATCH /listings/:id — update listing (auth required, owner or admin)
marketplaceRouter.patch('/listings/:id', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const userIsAdmin = await isAdmin(req.user!.id);
  const body = req.body;

  // Fetch current listing for notification & ownership check
  const { data: existing } = await supabase.from('marketplace_listings').select('*').eq('id', req.params.id).single();
  if (!existing) throw new AppError(404, 'Listing not found');

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.price !== undefined) updates.price = body.price;
  if (body.duration_hours !== undefined) updates.duration_hours = body.duration_hours;
  if (body.status !== undefined) updates.status = body.status;
  if (body.reason !== undefined) updates.admin_reason = body.reason;
  if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update');

  let query = supabase.from('marketplace_listings').update(updates).eq('id', req.params.id);
  if (!userIsAdmin) query = query.eq('provider_id', req.user!.id);

  const { data, error } = await query.select().single();
  if (error || !data) throw new AppError(404, 'Listing not found or not owned by you');

  // Send notification to poster if admin changed status
  if (userIsAdmin && body.status && body.status !== existing.status) {
    const reason = body.reason || 'No specific reason provided.';
    const statusLabel = (body.status as string).replace('_', ' ');
    await supabase.from('notifications').insert({
      profile_id: existing.provider_id,
      title: `Listing ${statusLabel}`,
      message: `Your listing "${existing.title}" has been ${body.status === 'cancelled' ? 'removed' : 'updated to ' + body.status} by an admin. Reason: ${reason}`,
      type: 'system',
    }).maybeSingle();
  }

  res.json({ data });
});

// DELETE /listings/:id — delete listing (auth required, owner or admin)
marketplaceRouter.delete('/listings/:id', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const userIsAdmin = await isAdmin(req.user!.id);

  // Fetch before deleting so we can notify the owner
  const { data: existing } = await supabase.from('marketplace_listings').select('*').eq('id', req.params.id).single();
  if (!existing) throw new AppError(404, 'Listing not found');

  let query = supabase.from('marketplace_listings').delete().eq('id', req.params.id);
  if (!userIsAdmin) query = query.eq('provider_id', req.user!.id);

  const { data, error } = await query.select().single();
  if (error || !data) throw new AppError(404, 'Listing not found or not owned by you');

  // Notify the poster if admin is deleting
  if (userIsAdmin) {
    const reason = req.query.reason as string || 'No specific reason provided.';
    await supabase.from('notifications').insert({
      profile_id: existing.provider_id,
      title: 'Listing Deleted',
      message: `Your listing "${existing.title}" has been deleted by an admin. Reason: ${reason}`,
      type: 'system',
    }).maybeSingle();
  }

  res.json({ data });
});

// ════════════════════════════════════════
// ORDERS
// ════════════════════════════════════════

// GET /orders — list orders with filters (auth required)
marketplaceRouter.get('/orders', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const role = req.query.role as string | undefined;
  const status = req.query.status as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  let query = supabase
    .from('orders')
    .select('*, listing:marketplace_listings(id, title, price), buyer:profiles!buyer_id(id, full_name, avatar_url), provider:profiles!provider_id(id, full_name, avatar_url)');

  if (role === 'buyer') query = query.eq('buyer_id', req.user!.id);
  else if (role === 'provider') query = query.eq('provider_id', req.user!.id);
  else query = query.or(`buyer_id.eq.${req.user!.id},provider_id.eq.${req.user!.id}`);

  if (status) query = query.eq('status', status);

  const { data, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw new AppError(500, error.message);
  res.json({ data, limit, offset });
});

// GET /orders/:id — single order (auth required, participant only)
marketplaceRouter.get('/orders/:id', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const { data, error } = await supabase
    .from('orders')
    .select('*, listing:marketplace_listings(*), buyer:profiles!buyer_id(id, full_name, avatar_url, headline), provider:profiles!provider_id(id, full_name, avatar_url, headline)')
    .eq('id', req.params.id)
    .single();

  if (error || !data) throw new AppError(404, 'Order not found');
  if (data.buyer_id !== req.user!.id && data.provider_id !== req.user!.id) throw new AppError(403, 'Access denied');
  res.json({ data });
});

// POST /orders — create order (auth required)
marketplaceRouter.post('/orders', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const { listing_id } = req.body;
  if (!listing_id) throw new AppError(400, 'Missing listing_id');

  const { data: listing, error: listingError } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('id', listing_id)
    .single();

  if (listingError || !listing) throw new AppError(404, 'Listing not found');
  if (listing.status !== 'active') throw new AppError(400, 'Listing is not active');
  if (listing.provider_id === req.user!.id) throw new AppError(400, 'Cannot order your own listing');

  const { data, error } = await supabase
    .from('orders')
    .insert({ listing_id, buyer_id: req.user!.id, provider_id: listing.provider_id, amount: listing.price, status: 'pending' })
    .select()
    .single();
  if (error) throw new AppError(500, error.message);

  await createNotification(supabase, listing.provider_id, 'New order received', `Someone hired you for "${listing.title}".`, 'order');
  res.status(201).json({ data });
});

// PATCH /orders/:id — update order status (auth required)
marketplaceRouter.patch('/orders/:id', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const { status: newStatus, rating, review, dispute_reason, dispute_description } = req.body;
  if (!newStatus) throw new AppError(400, 'Missing status');

  const { data: order, error: orderError } = await supabase.from('orders').select('*').eq('id', req.params.id).single();
  if (orderError || !order) throw new AppError(404, 'Order not found');
  if (order.buyer_id !== req.user!.id && order.provider_id !== req.user!.id) throw new AppError(403, 'Access denied');
  if (!canTransition(order.status, newStatus)) {
    throw new AppError(400, `Invalid transition: ${order.status} → ${newStatus}. Allowed: ${(VALID_TRANSITIONS[order.status] || []).join(', ')}`);
  }

  // Role guards
  if (newStatus === 'in_progress' && order.provider_id !== req.user!.id) throw new AppError(403, 'Only the provider can accept');
  if (newStatus === 'completed' && order.buyer_id !== req.user!.id) throw new AppError(403, 'Only the buyer can complete');
  if (newStatus === 'cancelled' && order.buyer_id !== req.user!.id) throw new AppError(403, 'Only the buyer can cancel');

  // Create dispute record
  if (newStatus === 'disputed') {
    await supabase.from('disputes').insert({
      order_id: req.params.id, raised_by: req.user!.id,
      reason: dispute_reason || 'No reason provided',
      description: dispute_description || '',
      status: 'open',
    }).maybeSingle();
  }

  // Fetch service fee
  let serviceFeePct = 5;
  const { data: feeSetting } = await supabase.from('site_settings').select('value').eq('key', 'service_fee').maybeSingle();
  if (feeSetting?.value && typeof feeSetting.value === 'object' && 'percentage' in (feeSetting.value as Record<string, unknown>)) {
    serviceFeePct = Number((feeSetting.value as Record<string, unknown>).percentage) || 5;
  }

  const updates: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'in_progress') {
    updates.escrow_release_at = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    updates.service_fee_percentage = serviceFeePct;
  }
  if (newStatus === 'completed') {
    updates.completed_at = new Date().toISOString();
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) throw new AppError(400, 'Rating must be 1-5');
      updates.rating = rating;
    }
    if (review !== undefined) updates.review = review;
  }

  const { data, error } = await supabase.from('orders').update(updates).eq('id', req.params.id).select().single();
  if (error) throw new AppError(500, error.message);

  // Notifications
  if (newStatus === 'in_progress') await createNotification(supabase, order.buyer_id, 'Order in progress', 'Your order has been accepted.', 'order');
  else if (newStatus === 'completed') await createNotification(supabase, order.provider_id, 'Order completed', 'Your order was marked complete.', 'order');
  else if (newStatus === 'disputed') {
    await createNotification(supabase, order.provider_id, 'Order disputed', 'An order has been disputed.', 'order');
    await createNotification(supabase, order.buyer_id, 'Order disputed', 'Your dispute has been submitted.', 'order');
  } else if (newStatus === 'cancelled') await createNotification(supabase, order.provider_id, 'Order cancelled', 'An order was cancelled.', 'order');

  res.json({ data });
});

// ── Milestones ──

// GET /orders/:id/milestones (auth required)
marketplaceRouter.get('/orders/:id/milestones', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const { data: order } = await supabase.from('orders').select('id').eq('id', req.params.id).or(`buyer_id.eq.${req.user!.id},provider_id.eq.${req.user!.id}`).maybeSingle();
  if (!order) throw new AppError(403, 'Access denied');

  const { data, error } = await supabase.from('order_milestones').select('*').eq('order_id', req.params.id).order('created_at', { ascending: true });
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// POST /orders/:id/milestones — create milestone (auth required, provider only)
marketplaceRouter.post('/orders/:id/milestones', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const { title, description, amount, due_date } = req.body;
  if (!title || !title.trim() || !amount) throw new AppError(400, 'Title and amount required');

  const { data: order } = await supabase.from('orders').select('id, provider_id, amount').eq('id', req.params.id).single();
  if (!order || order.provider_id !== req.user!.id) throw new AppError(403, 'Only the provider can add milestones');

  const { data: existing } = await supabase.from('order_milestones').select('amount').eq('order_id', req.params.id);
  const existingTotal = (existing || []).reduce((sum: number, m: any) => sum + Number(m.amount), 0);
  if (existingTotal + Number(amount) > Number(order.amount)) throw new AppError(400, 'Milestone total exceeds order amount');

  const { data, error } = await supabase
    .from('order_milestones')
    .insert({ order_id: req.params.id, title: title.trim(), description: description?.trim() || null, amount, due_date: due_date || null, created_by: req.user!.id, status: 'pending' })
    .select()
    .single();
  if (error) throw new AppError(500, error.message);
  res.status(201).json({ data });
});

// PATCH /orders/:id/milestones/:mid — update milestone status (auth required)
marketplaceRouter.patch('/orders/:id/milestones/:mid', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const { status: newStatus } = req.body;
  if (!newStatus) throw new AppError(400, 'Missing status');

  const { data: milestone } = await supabase
    .from('order_milestones')
    .select('*, orders!inner(id, buyer_id, provider_id, status)')
    .eq('id', req.params.mid)
    .single();

  if (!milestone) throw new AppError(404, 'Milestone not found');
  const order = milestone.orders as any;

  const VALID_ML_TRANSITIONS: Record<string, string[]> = { pending: ['in_progress'], in_progress: ['submitted'], submitted: ['approved', 'rejected'], approved: [], rejected: [] };
  const allowed = VALID_ML_TRANSITIONS[milestone.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(400, `Invalid milestone transition: ${milestone.status} → ${newStatus}. Allowed: ${allowed.join(', ')}`);
  }

  if ((newStatus === 'in_progress' || newStatus === 'submitted') && order.provider_id !== req.user!.id) throw new AppError(403, 'Only the provider can start/submit milestones');
  if ((newStatus === 'approved' || newStatus === 'rejected') && order.buyer_id !== req.user!.id) throw new AppError(403, 'Only the buyer can approve/reject');

  const { data, error } = await supabase.from('order_milestones').update({ status: newStatus }).eq('id', req.params.mid).select().single();
  if (error) throw new AppError(500, error.message);

  if (newStatus === 'approved') {
    await createNotification(supabase, order.provider_id, 'Milestone approved', `Milestone "${milestone.title}" was approved.`, 'order');
  }
  res.json({ data });
});

// ════════════════════════════════════════
// DISPUTES
// ════════════════════════════════════════

// GET /disputes — list disputes for current user (auth required)
marketplaceRouter.get('/disputes', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const { data: userOrders } = await supabase.from('orders').select('id').or(`buyer_id.eq.${req.user!.id},provider_id.eq.${req.user!.id}`);
  const orderIds = (userOrders || []).map((o: any) => o.id);

  const { data, error } = await supabase
    .from('disputes')
    .select('*, order:orders(id, title, amount, status), raised_by_profile:profiles!raised_by(id, full_name, avatar_url)')
    .or(`raised_by.eq.${req.user!.id}${orderIds.length > 0 ? `,order_id.in.(${orderIds.join(',')})` : ''}`)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  res.json({ data: data || [] });
});

// GET /disputes/:id — single dispute (auth required)
marketplaceRouter.get('/disputes/:id', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const { data, error } = await supabase
    .from('disputes')
    .select('*, order:orders(id, title, amount, status), raised_by_profile:profiles!raised_by(id, full_name, avatar_url), resolved_by_profile:profiles!resolved_by(id, full_name)')
    .eq('id', req.params.id)
    .single();

  if (error || !data) throw new AppError(404, 'Dispute not found');

  const userId = req.user!.id;
  const { data: order } = await supabase.from('orders').select('buyer_id, provider_id').eq('id', data.order_id).single();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();

  const isParticipant = order && (order.buyer_id === userId || order.provider_id === userId);
  const isRaisedBy = data.raised_by === userId;
  const isAdminUser = profile?.role === 'admin';

  if (!isParticipant && !isRaisedBy && !isAdminUser) throw new AppError(403, 'Access denied');
  res.json({ data });
});

// GET /disputes/:id/messages — list messages (auth required)
marketplaceRouter.get('/disputes/:id/messages', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const { data, error } = await supabase.from('dispute_messages').select('*, sender:profiles(id, full_name, avatar_url)').eq('dispute_id', req.params.id).order('created_at', { ascending: true });
  if (error) throw new AppError(500, error.message);
  res.json({ data: data || [] });
});

// POST /disputes/:id/messages — send message (auth required)
marketplaceRouter.post('/disputes/:id/messages', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const { message } = req.body;
  if (!message || !message.trim()) throw new AppError(400, 'Message is required');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', req.user!.id).single();
  const isAdminUser = profile?.role === 'admin';

  const { data, error } = await supabase
    .from('dispute_messages')
    .insert({ dispute_id: req.params.id, sender_id: req.user!.id, message: message.trim(), is_admin_message: isAdminUser })
    .select('*, sender:profiles(id, full_name, avatar_url)')
    .single();
  if (error) throw new AppError(500, error.message);

  if (isAdminUser) {
    await supabase.from('disputes').update({ status: 'under_review' }).eq('id', req.params.id).eq('status', 'open');
  }
  res.status(201).json({ data });
});

// ════════════════════════════════════════
// REVIEWS
// ════════════════════════════════════════

// GET /reviews/listing/:id/stats (public)
marketplaceRouter.get('/reviews/listing/:id/stats', async (req: Request, res: Response) => {
  const supabase = getDb(req);
  const { data, error } = await supabase
    .from('orders')
    .select('rating')
    .eq('listing_id', req.params.id)
    .eq('status', 'completed')
    .not('rating', 'is', null);
  if (error) throw new AppError(500, error.message);

  const ratings = (data || []).map((r: any) => r.rating);
  const count = ratings.length;
  const average = count > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / count : 0;
  res.json({ data: { average: Math.round(average * 10) / 10, count } });
});

// GET /reviews/listing/:id (public)
marketplaceRouter.get('/reviews/listing/:id', async (req: Request, res: Response) => {
  const supabase = getDb(req);
  const { data, error } = await supabase
    .from('orders')
    .select('id, rating, review, created_at, buyer:profiles!orders_buyer_id_fkey(id, full_name, avatar_url)')
    .eq('listing_id', req.params.id)
    .eq('status', 'completed')
    .not('rating', 'is', null)
    .not('review', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// GET /reviews/provider/:id/stats (public)
marketplaceRouter.get('/reviews/provider/:id/stats', async (req: Request, res: Response) => {
  const supabase = getDb(req);
  const { data, error } = await supabase
    .from('orders')
    .select('rating')
    .eq('provider_id', req.params.id)
    .eq('status', 'completed')
    .not('rating', 'is', null);
  if (error) throw new AppError(500, error.message);

  const ratings = (data || []).map((r: any) => r.rating);
  const count = ratings.length;
  const average = count > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / count : 0;
  res.json({ data: { average: Math.round(average * 10) / 10, count } });
});

// GET /reviews/provider/:id (public)
marketplaceRouter.get('/reviews/provider/:id', async (req: Request, res: Response) => {
  const supabase = getDb(req);
  const { data, error } = await supabase
    .from('orders')
    .select('id, rating, review, created_at, listing:marketplace_listings!inner(id, title), buyer:profiles!orders_buyer_id_fkey(id, full_name, avatar_url)')
    .eq('provider_id', req.params.id)
    .eq('status', 'completed')
    .not('rating', 'is', null)
    .not('review', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// POST /reviews/orders/:id — submit review on completed order (auth required)
marketplaceRouter.post('/reviews/orders/:id', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const { rating, review } = req.body;
  if (!rating || rating < 1 || rating > 5) throw new AppError(400, 'Rating must be between 1 and 5');
  if (!review || review.trim().length < 10) throw new AppError(400, 'Review must be at least 10 characters');

  const { data: order, error: orderError } = await supabase.from('orders').select('id, buyer_id, status').eq('id', req.params.id).single();
  if (orderError || !order) throw new AppError(404, 'Order not found');
  if (order.buyer_id !== req.user!.id) throw new AppError(403, 'Only the buyer can review');
  if (order.status !== 'completed') throw new AppError(400, 'Can only review completed orders');

  const { data, error } = await supabase.from('orders').update({ rating, review: review.trim() }).eq('id', req.params.id).select('id, rating, review').single();
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// PUT /reviews/orders/:id — edit existing review (auth required)
marketplaceRouter.put('/reviews/orders/:id', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const { rating, review } = req.body;
  if (rating !== undefined && (rating < 1 || rating > 5)) throw new AppError(400, 'Rating must be between 1 and 5');
  if (review !== undefined && review.trim().length < 10) throw new AppError(400, 'Review must be at least 10 characters');

  const { data: order, error: orderError } = await supabase.from('orders').select('id, buyer_id, rating').eq('id', req.params.id).single();
  if (orderError || !order) throw new AppError(404, 'Order not found');
  if (order.buyer_id !== req.user!.id) throw new AppError(403, 'Only the buyer can edit');
  if (!order.rating) throw new AppError(400, 'No review exists on this order yet');

  const updates: Record<string, unknown> = {};
  if (rating !== undefined) updates.rating = rating;
  if (review !== undefined) updates.review = review.trim();

  const { data, error } = await supabase.from('orders').update(updates).eq('id', req.params.id).select('id, rating, review').single();
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// DELETE /reviews/orders/:id — delete review (auth required, buyer or admin)
marketplaceRouter.delete('/reviews/orders/:id', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const { data: order, error: orderError } = await supabase.from('orders').select('id, buyer_id').eq('id', req.params.id).single();
  if (orderError || !order) throw new AppError(404, 'Order not found');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', req.user!.id).single();
  if (order.buyer_id !== req.user!.id && profile?.role !== 'admin') throw new AppError(403, 'Only the buyer or an admin can delete this review');

  const { error } = await supabase.from('orders').update({ rating: null, review: null }).eq('id', req.params.id);
  if (error) throw new AppError(500, error.message);
  res.json({ data: { id: req.params.id } });
});
