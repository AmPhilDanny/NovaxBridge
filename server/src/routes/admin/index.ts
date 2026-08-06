import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { adminClient } from '../../lib/supabase-admin.js';
import { requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { auditLog } from '../../middleware/audit.js';
import { AppError } from '../../middleware/error.js';

export const adminRouter: Router = Router();

// All admin routes require auth + admin role
adminRouter.use(requireAdmin);

// ── GET /admin/stats ──
adminRouter.get('/stats', async (_req: Request, res: Response) => {
  const [profileCount, orderData, disputeData, payoutData, txData] = await Promise.all([
    adminClient.from('profiles').select('id', { count: 'exact', head: true }),
    adminClient.from('orders').select('status, amount'),
    adminClient.from('disputes').select('status'),
    adminClient.from('payouts').select('status, amount'),
    adminClient.from('wallet_transactions').select('type, amount'),
  ]);

  const totalUsers = profileCount?.count ?? 0;
  const totalOrders = orderData?.data?.length ?? 0;
  const completedOrders = (orderData?.data || []).filter((o: any) => o.status === 'completed').length;
  const totalRevenue = (txData?.data || [])
    .filter((tx: any) => tx.type === 'credit')
    .reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);
  const pendingPayouts = (payoutData?.data || [])
    .filter((p: any) => p.status === 'pending')
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const openDisputes = (disputeData?.data || []).filter((d: any) => d.status === 'open' || d.status === 'under_review').length;

  res.json({
    data: {
      total_users: totalUsers,
      total_orders: totalOrders,
      completed_orders: completedOrders,
      total_revenue: totalRevenue,
      pending_payouts: pendingPayouts,
      open_disputes: openDisputes,
    },
  });
});

// ── GET /admin/users ──
adminRouter.get('/users', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const roleFilter = req.query.role as string | undefined;
  const search = req.query.search as string | undefined;

  let countQuery = adminClient.from('profiles').select('id', { count: 'exact', head: true });
  if (roleFilter) countQuery = countQuery.eq('role', roleFilter);
  const { count } = await countQuery;

  let query = adminClient.from('profiles').select('*').order('created_at', { ascending: false });
  if (roleFilter) query = query.eq('role', roleFilter);
  if (search) query = query.ilike('full_name', `%${search}%`);

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw new AppError(500, error.message);

  res.json({ data, count, limit, offset });
});

// ── PATCH /admin/users/:id/role ──
adminRouter.patch('/users/:id/role',
  validate(z.object({ role: z.string().min(1) })),
  async (req: Request, res: Response) => {
    const { role } = req.body;
    const { id } = req.params;

    const { data, error } = await adminClient
      .from('profiles')
      .update({ role })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new AppError(500, error.message);

    res.json({ data });
  }
);

// ── GET /admin/users/:id ──
adminRouter.get('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) throw new AppError(404, 'User not found');
  res.json({ data });
});

// ── PATCH /admin/users/:id/confirm-email — Super admin confirms user email ──
adminRouter.patch('/users/:id/confirm-email', async (req: Request, res: Response) => {
  const { id } = req.params;
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
      apikey: serviceRole,
    },
    body: JSON.stringify({ email_confirm: true }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ msg: `HTTP ${response.status}` }));
    throw new AppError(response.status, err.msg || 'Failed to confirm email');
  }

  const result = await response.json();
  res.json({ data: { id: result.id, email: result.email, email_confirmed_at: result.email_confirmed_at } });
});

// ── GET /admin/users/:id/email-status — Check email confirmation status ──
adminRouter.get('/users/:id/email-status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${serviceRole}`,
      apikey: serviceRole,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ msg: `HTTP ${response.status}` }));
    throw new AppError(response.status, err.msg || 'Failed to fetch email status');
  }

  const result = await response.json();
  res.json({ data: { id: result.id, email: result.email, email_confirmed_at: result.email_confirmed_at || null } });
});

// ── POST /admin/users/:id/resend-confirmation — Resend email verification ──
adminRouter.post('/users/:id/resend-confirmation', async (req: Request, res: Response) => {
  const { id } = req.params;
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const redirectTo = (req.query.redirect_to as string) || process.env.SITE_URL || `${process.env.SUPABASE_URL}/auth/v1/verify`;

  const userRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${serviceRole}`,
      apikey: serviceRole,
    },
  });

  if (!userRes.ok) {
    const err = await userRes.json().catch(() => ({ msg: `HTTP ${userRes.status}` }));
    throw new AppError(userRes.status, err.msg || 'Failed to fetch user');
  }

  const user = await userRes.json();
  if (!user.email) throw new AppError(400, 'User has no email address');

  const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}/generate_link`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
      apikey: serviceRole,
    },
    body: JSON.stringify({
      type: 'signup',
      email: user.email,
      redirect_to: redirectTo,
    }),
  });

  if (!linkRes.ok) {
    const err = await linkRes.json().catch(() => ({ msg: `HTTP ${linkRes.status}` }));
    throw new AppError(linkRes.status, err.msg || 'Failed to resend confirmation');
  }

  const linkResult = await linkRes.json();
  res.json({ data: { email: user.email, action_link: linkResult.action_link } });
});

// ── PATCH /admin/users/:id/profile ──
adminRouter.patch('/users/:id/profile',
  validate(z.object({
    full_name: z.string().nullable().optional(),
    headline: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
    role: z.string().optional(),
    location: z.string().nullable().optional(),
    company_name: z.string().nullable().optional(),
    avatar_url: z.string().nullable().optional(),
    github_url: z.string().nullable().optional(),
    availability: z.string().optional(),
    preferred_currency: z.string().optional(),
    skills: z.array(z.string()).optional(),
  })),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const allowedFields = [
      'full_name', 'headline', 'bio', 'role', 'location',
      'company_name', 'avatar_url', 'github_url',
      'availability', 'preferred_currency', 'skills',
    ];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if ((req.body as any)[field] !== undefined) updates[field] = (req.body as any)[field];
    }
    if (Object.keys(updates).length === 0) {
      throw new AppError(400, 'No valid fields to update');
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await adminClient
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new AppError(500, error.message);
    res.json({ data });
  }
);

// ── PATCH /admin/users/:id/email — Admin updates user email ──
adminRouter.patch('/users/:id/email',
  validate(z.object({ email: z.string().email() })),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { email } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${serviceRole}`,
        'Content-Type': 'application/json',
        apikey: serviceRole,
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ msg: `HTTP ${response.status}` }));
      throw new AppError(response.status, err.msg || 'Failed to update email');
    }

    const result = await response.json();
    res.json({ data: { id: result.id, email: result.email, email_confirmed_at: result.email_confirmed_at || null } });
  }
);

// ── PATCH /admin/users/:id/deactivate — Soft-delete a user ──
adminRouter.patch('/users/:id/deactivate', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await adminClient
    .from('profiles')
    .update({ is_active: false, role: 'student', headline: null, full_name: '[deactivated]', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ── PATCH /admin/users/:id/activate — Reactivate a user ──
adminRouter.patch('/users/:id/activate', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await adminClient
    .from('profiles')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ── DELETE /admin/users/:id — Permanently delete a user ──
adminRouter.delete('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  // Delete from profiles table
  const { error: profileErr } = await adminClient.from('profiles').delete().eq('id', id);
  if (profileErr) throw new AppError(500, profileErr.message);
  // Also delete from Supabase Auth
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${serviceRole}`, apikey: serviceRole },
  });
  if (!authRes.ok && authRes.status !== 404) {
    const err = await authRes.json().catch(() => ({ msg: `HTTP ${authRes.status}` }));
    throw new AppError(500, err.msg || 'Failed to delete auth user');
  }
  res.json({ data: { id, deleted: true } });
});

// ── GET /admin/services ──
adminRouter.get('/services', async (_req: Request, res: Response) => {
  const { data, error } = await adminClient.from('services').select('*').order('name');
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ── POST /admin/services ──
adminRouter.post('/services',
  validate(z.object({
    name: z.string().min(1),
    slug: z.string().optional(),
    description: z.string().optional(),
    category: z.string().min(1),
    base_price: z.number().optional(),
    is_active: z.boolean().optional(),
  })),
  auditLog('create_service', 'services', (req) => null),
  async (req: Request, res: Response) => {
    const { name, slug, description, category, base_price, is_active } = req.body;
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
    const { data, error } = await adminClient
      .from('services')
      .insert({ name, slug: finalSlug, description: description || null, category, base_price: base_price ?? 0, is_active: is_active ?? true })
      .select()
      .single();
    if (error) throw new AppError(500, error.message);
    res.status(201).json({ data });
  }
);

// ── PATCH /admin/services/:id ──
adminRouter.patch('/services/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body;
  const updates: Record<string, unknown> = {};
  for (const field of ['name', 'slug', 'description', 'category', 'base_price', 'is_active']) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update');

  const { data, error } = await adminClient.from('services').update(updates).eq('id', id).select().single();
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ── DELETE /admin/services/:id ──
adminRouter.delete('/services/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await adminClient.from('services').delete().eq('id', id).select().single();
  if (error) throw new AppError(404, 'Service not found');
  res.json({ data });
});

// ── GET /admin/disputes ──
adminRouter.get('/disputes', async (req: Request, res: Response) => {
  const statusFilter = req.query.status as string | undefined;
  let query = adminClient
    .from('disputes')
    .select('*, order:orders(id, title, amount, status), raised_by_profile:profiles!raised_by(id, full_name, avatar_url), resolved_by_profile:profiles!resolved_by(id, full_name)')
    .order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);
  const { data, error } = await query;
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ── PATCH /admin/disputes/:id ──
adminRouter.patch('/disputes/:id',
  validate(z.object({ status: z.enum(['resolved', 'dismissed', 'under_review']), resolution: z.string().optional() })),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, resolution } = req.body;
    const updateData: Record<string, unknown> = {
      status,
      resolved_by: req.user?.id,
      resolved_at: new Date().toISOString(),
    };
    if (resolution) updateData.resolution = resolution;

    const { data, error } = await adminClient.from('disputes').update(updateData).eq('id', id).select().single();
    if (error) throw new AppError(500, error.message);
    res.json({ data });
  }
);

// ── GET /admin/payouts ──
adminRouter.get('/payouts', async (req: Request, res: Response) => {
  const statusFilter = req.query.status as string | undefined;
  let query = adminClient.from('payouts').select('*, profile:profiles(id, full_name, avatar_url)').order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);
  const { data, error } = await query;
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ════════════════════════════════════════
// CMS PAGES — CRUD
// ════════════════════════════════════════

// ── GET /admin/pages — list all pages (admin can see drafts) ──
adminRouter.get('/pages', async (_req: Request, res: Response) => {
  const { data, error } = await adminClient
    .from('pages')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    if (error.code === '42P01') return res.json({ data: [] });
    throw new AppError(500, error.message);
  }
  res.json({ data });
});

// ── GET /admin/pages/:id — get single page ──
adminRouter.get('/pages/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await adminClient
    .from('pages')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) throw new AppError(404, 'Page not found');
  res.json({ data });
});

// ── POST /admin/pages — create page ──
adminRouter.post('/pages',
  validate(z.object({
    slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
    title: z.string().min(1).max(500),
    content_html: z.string().default(''),
    status: z.enum(['draft', 'published']).default('draft'),
  })),
  async (req: Request, res: Response) => {
    const { slug, title, content_html, status } = req.body;
    const { data, error } = await adminClient
      .from('pages')
      .insert({ slug, title, content_html, status })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new AppError(409, 'A page with this slug already exists');
      throw new AppError(500, error.message);
    }
    res.json({ data });
  }
);

// ── PATCH /admin/pages/:id — update page ──
adminRouter.patch('/pages/:id',
  validate(z.object({
    slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
    title: z.string().min(1).max(500).optional(),
    content_html: z.string().optional(),
    status: z.enum(['draft', 'published']).optional(),
  }).refine(data => Object.keys(data).length > 0, { message: 'No fields to update' })),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates: Record<string, unknown> = { ...req.body, updated_at: new Date().toISOString() };

    const { data, error } = await adminClient
      .from('pages')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new AppError(409, 'Slug already in use');
      throw new AppError(500, error.message);
    }
    if (!data) throw new AppError(404, 'Page not found');
    res.json({ data });
  }
);

// ── DELETE /admin/pages/:id — delete page (blocked for system pages) ──
adminRouter.delete('/pages/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  // Check if page is a system page
  const { data: existing } = await adminClient
    .from('pages')
    .select('id, is_system')
    .eq('id', id)
    .single();
  if (!existing) throw new AppError(404, 'Page not found');
  if (existing.is_system) throw new AppError(403, 'System pages cannot be deleted');

  const { error } = await adminClient.from('pages').delete().eq('id', id);
  if (error) throw new AppError(500, error.message);
  res.json({ data: { id, deleted: true } });
});

// ── GET /admin/settings ──
adminRouter.get('/settings', async (_req: Request, res: Response) => {
  const { data, error } = await adminClient.from('site_settings').select('*').order('key');
  if (error) throw new AppError(500, error.message);
  const settings: Record<string, unknown> = {};
  for (const row of data || []) {
    settings[row.key] = row.value;
  }
  res.json({ data: settings });
});

// ── PATCH /admin/settings ──
adminRouter.patch('/settings',
  validate(z.object({ key: z.string().min(1), value: z.any() })),
  auditLog('update_settings', 'site_settings', (req) => null),
  async (req: Request, res: Response) => {
    const { key, value } = req.body;
    await adminClient.from('site_settings').upsert({ key, value }, { onConflict: 'key' });
    res.json({ data: { key, value } });
  }
);

// ── PATCH /admin/settings/batch — Bulk save multiple settings ──
adminRouter.patch('/settings/batch',
  validate(z.object({ settings: z.record(z.any()) })),
  async (req: Request, res: Response) => {
    const { settings } = req.body;
    const entries = Object.entries(settings);
    if (entries.length === 0) throw new AppError(400, 'No settings provided');

    const results: Record<string, unknown> = {};
    for (const [key, value] of entries) {
      await adminClient.from('site_settings').upsert({ key, value }, { onConflict: 'key' });
      results[key] = value;
    }
    res.json({ data: results });
  }
);

// ── GET /admin/manual-payments ──
adminRouter.get('/manual-payments', async (req: Request, res: Response) => {
  const statusFilter = req.query.status as string | undefined;
  let query = adminClient
    .from('manual_payments')
    .select('*, buyer:profiles!buyer_id(id, full_name, avatar_url), reviewed_by_profile:profiles!reviewed_by(id, full_name)')
    .order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);
  const { data, error } = await query;
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ── PATCH /admin/manual-payments/:id/approve ──
adminRouter.patch('/manual-payments/:id/approve', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { admin_notes } = req.body || {};

  const { data: payment } = await adminClient.from('manual_payments').select('*').eq('id', id).single();
  if (!payment) throw new AppError(404, 'Payment not found');

  const { data, error } = await adminClient
    .from('manual_payments')
    .update({ status: 'approved', reviewed_by: req.user?.id, reviewed_at: new Date().toISOString(), admin_notes: admin_notes || null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new AppError(500, error.message);

  await adminClient.from('orders').update({ payment_status: 'paid' }).eq('id', payment.order_id);
  if (payment.payment_intent_id) {
    await adminClient.from('payment_intents').update({ status: 'success' }).eq('id', payment.payment_intent_id);
  }

  res.json({ data });
});

// ── PATCH /admin/manual-payments/:id/reject ──
adminRouter.patch('/manual-payments/:id/reject', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { admin_notes } = req.body || {};
  const { data, error } = await adminClient
    .from('manual_payments')
    .update({ status: 'rejected', reviewed_by: req.user?.id, reviewed_at: new Date().toISOString(), admin_notes: admin_notes || null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ── GET /admin/provider-bank-accounts ──
adminRouter.get('/provider-bank-accounts', async (req: Request, res: Response) => {
  const kycFilter = req.query.kyc_status as string | undefined;
  let query = adminClient.from('provider_bank_accounts').select('*, profile:profiles(id, full_name, avatar_url)').order('created_at', { ascending: false });
  if (kycFilter) query = query.eq('kyc_status', kycFilter);
  const { data, error } = await query;
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ── PATCH /admin/provider-bank-accounts/:id/verify ──
adminRouter.patch('/provider-bank-accounts/:id/verify',
  validate(z.object({ kyc_status: z.enum(['verified', 'rejected']), kyc_notes: z.string().optional() })),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { kyc_status, kyc_notes } = req.body;
    const { data, error } = await adminClient
      .from('provider_bank_accounts')
      .update({ kyc_status, verified_by: kyc_status === 'verified' ? req.user?.id : null, verified_at: kyc_status === 'verified' ? new Date().toISOString() : null, kyc_notes: kyc_notes || null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new AppError(500, error.message);
    res.json({ data });
  }
);

// ── GET /admin/audit-log ──
adminRouter.get('/audit-log', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const { data, error } = await adminClient
    .from('admin_audit_log')
    .select('*, admin:profiles(id, full_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ── GET /admin/listings — all marketplace listings ──
adminRouter.get('/listings', async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  let query = adminClient
    .from('marketplace_listings')
    .select('*, service:services(id, name, slug, category), provider:profiles(id, full_name, avatar_url)', { count: 'exact' });

  if (status) query = query.eq('status', status);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw new AppError(500, error.message);
  res.json({ data, count, limit, offset });
});

// ── PATCH /admin/listings/:id — admin update listing ──
adminRouter.patch('/listings/:id',
  validate(z.object({
    status: z.enum(['active', 'inactive', 'paused', 'completed', 'cancelled']).optional(),
    reason: z.string().optional(),
    expires_at: z.string().optional(),
  })),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates: Record<string, unknown> = {};
    if (req.body.status) updates.status = req.body.status;
    if (req.body.reason) updates.admin_reason = req.body.reason;
    if (req.body.expires_at !== undefined) updates.expires_at = req.body.expires_at || null;
    if (Object.keys(updates).length === 0) throw new AppError(400, 'No fields to update');

    const { data: existing } = await adminClient.from('marketplace_listings').select('*, provider:profiles(id, full_name)').eq('id', id).single();
    if (!existing) throw new AppError(404, 'Listing not found');

    const { data, error } = await adminClient.from('marketplace_listings').update(updates).eq('id', id).select().single();
    if (error) throw new AppError(500, error.message);

    // Notify the owner
    if (req.body.status && req.body.status !== existing.status) {
      const reason = req.body.reason || 'No specific reason provided.';
      const statusLabel = (req.body.status as string).replace('_', ' ');
      await adminClient.from('notifications').insert({
        profile_id: existing.provider_id,
        title: `Listing ${statusLabel}`,
        message: `Your listing "${existing.title}" has been ${req.body.status === 'cancelled' ? 'removed' : 'updated to ' + req.body.status} by an admin. Reason: ${reason}`,
        type: 'system',
      }).maybeSingle();
    }

    res.json({ data });
  }
);

// ── DELETE /admin/listings/:id — admin delete listing ──
adminRouter.delete('/listings/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const reason = (req.query.reason as string) || '';

  const { data: existing } = await adminClient.from('marketplace_listings').select('*, provider:profiles(id, full_name)').eq('id', id).single();
  if (!existing) throw new AppError(404, 'Listing not found');

  const { data, error } = await adminClient.from('marketplace_listings').delete().eq('id', id).select().single();
  if (error) throw new AppError(500, error.message);

  // Notify the owner
  const reasonMsg = reason ? ` Reason: ${reason}` : '';
  await adminClient.from('notifications').insert({
    profile_id: existing.provider_id,
    title: 'Listing Deleted',
    message: `Your listing "${existing.title}" has been deleted by an admin.${reasonMsg}`,
    type: 'system',
  }).maybeSingle();

  res.json({ data });
});

// ── GET /admin/projects — all projects ──
adminRouter.get('/projects', async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  let query = adminClient
    .from('projects')
    .select('*, owner:profiles(id, full_name, avatar_url)')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ── PATCH /admin/projects/:id — admin update project ──
adminRouter.patch('/projects/:id',
  validate(z.object({ status: z.string().optional(), reason: z.string().optional() })),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates: Record<string, unknown> = {};
    if (req.body.status) updates.status = req.body.status;
    if (req.body.reason) updates.admin_reason = req.body.reason;
    if (Object.keys(updates).length === 0) throw new AppError(400, 'No fields to update');

    const { data: existing } = await adminClient.from('projects').select('*, owner:profiles(id, full_name)').eq('id', id).single();
    if (!existing) throw new AppError(404, 'Project not found');

    const { data, error } = await adminClient.from('projects').update(updates).eq('id', id).select().single();
    if (error) throw new AppError(500, error.message);

    if (req.body.status && req.body.status !== existing.status) {
      const reason = req.body.reason || 'No specific reason provided.';
      await adminClient.from('notifications').insert({
        profile_id: existing.owner_id,
        title: `Project ${req.body.status}`,
        message: `Your project "${existing.title}" has been updated to ${req.body.status} by an admin. Reason: ${reason}`,
        type: 'system',
      }).maybeSingle();
    }

    res.json({ data });
  }
);

// ── DELETE /admin/projects/:id — admin delete project ──
adminRouter.delete('/projects/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const reason = (req.query.reason as string) || '';

  const { data: existing } = await adminClient.from('projects').select('*, owner:profiles(id, full_name)').eq('id', id).single();
  if (!existing) throw new AppError(404, 'Project not found');

  const { data, error } = await adminClient.from('projects').delete().eq('id', id).select().single();
  if (error) throw new AppError(500, error.message);

  const reasonMsg = reason ? ` Reason: ${reason}` : '';
  await adminClient.from('notifications').insert({
    profile_id: existing.owner_id,
    title: 'Project Deleted',
    message: `Your project "${existing.title}" has been deleted by an admin.${reasonMsg}`,
    type: 'system',
  }).maybeSingle();

  res.json({ data });
});

// ── GET /admin/config ──
adminRouter.get('/config', async (_req: Request, res: Response) => {
  const { data, error } = await adminClient.from('platform_config').select('*').order('key');
  if (error) throw new AppError(500, error.message);
  const config: Record<string, unknown> = {};
  for (const row of data || []) {
    config[row.key] = row.value;
  }
  res.json({ data: config });
});

// ── PATCH /admin/config ──
adminRouter.patch('/config',
  validate(z.object({ key: z.string().min(1), value: z.any() })),
  async (req: Request, res: Response) => {
    const { key, value } = req.body;
    await adminClient.from('platform_config').upsert({ key, value }, { onConflict: 'key' });
    res.json({ data: { key, value } });
  }
);

// ── POST /admin/listings/expire-check — expire listings past their TTL ──
adminRouter.post('/listings/expire-check', async (_req: Request, res: Response) => {
  const { data: configData } = await adminClient.from('platform_config').select('value').eq('key', 'listing_ttl_days').maybeSingle();
  const ttlDays = configData?.value as number | null;
  if (!ttlDays || ttlDays <= 0) {
    res.json({ status: 'ok', expired: 0, message: 'No listing TTL configured' });
    return;
  }
  const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: expired, error } = await adminClient
    .from('marketplace_listings')
    .update({ status: 'inactive' })
    .eq('status', 'active')
    .lt('created_at', cutoff)
    .select();
  if (error) throw new AppError(500, error.message);
  res.json({ status: 'ok', expired: expired?.length || 0, ttlDays });
});

// ── POST /admin/upload — upload site asset using service_role (bypasses RLS) ──
import multer from 'multer';
const upload_multer = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
adminRouter.post('/upload', upload_multer.single('file'), async (req: Request, res: Response) => {
  const f = (req as any).file as { originalname: string; buffer: Buffer; mimetype: string } | undefined;
  if (!f) throw new AppError(400, 'No file provided');
  const folder = (req.body.folder as string) || 'brand';
  const fileName = `${Date.now()}-${f.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const filePath = `${folder}/${fileName}`;
  const { error: uploadError } = await adminClient.storage.from('site-assets').upload(filePath, f.buffer, {
    contentType: f.mimetype,
    upsert: true,
  });
  if (uploadError) throw new AppError(500, uploadError.message);
  const { data: urlData } = adminClient.storage.from('site-assets').getPublicUrl(filePath);
  res.json({ data: { url: urlData?.publicUrl || null, path: filePath } });
});

// ════════════════════════════════════════
// ORGANIZATIONS (B2B)
// ════════════════════════════════════════

// ── GET /admin/orgs ──
adminRouter.get('/orgs', async (req: Request, res: Response) => {
  const search = req.query.search as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    let query = adminClient
      .from('organizations')
      .select('id, name, slug, industry, size, description, website_url, subscription_plan_id, subscription_starts_at, created_at, updated_at, status', { count: 'exact' });

    if (search) query = query.ilike('name', `%${search}%`);

    const { data: orgs, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (error.code === '42P01') {
        return res.json({ data: [], count: 0, limit, offset });
      }
      throw new AppError(500, error.message);
    }

    // Enrich with member counts and plan names
    const orgIds = (orgs || []).map((o: any) => o.id);

    const [memberCounts, plans] = await Promise.all([
      orgIds.length > 0
        ? adminClient
            .from('org_members')
            .select('org_id, count:org_id', { count: 'exact', head: true })
            .in('org_id', orgIds)
            .then(() =>
              // Manual counting since Supabase count with group is tricky
              Promise.all(orgIds.map((oid: string) =>
                adminClient
                  .from('org_members')
                  .select('id', { count: 'exact', head: true })
                  .eq('org_id', oid)
                  .then(r => ({ org_id: oid, count: r.count ?? 0 }))
              ))
            )
        : Promise.resolve([] as { org_id: string; count: number }[]),

      adminClient
        .from('subscription_plans')
        .select('id, name, slug'),
    ]);

    const planMap = new Map((plans.data || []).map((p: any) => [p.id, p]));
    const countMap = new Map(memberCounts.map((m: any) => [m.org_id, m.count]));

    const data = (orgs || []).map((org: any) => ({
      ...org,
      member_count: countMap.get(org.id) ?? 0,
      plan: planMap.get(org.subscription_plan_id) || null,
    }));

    res.json({ data, count, limit, offset });
  } catch (err) {
    if (err instanceof AppError) throw err;
    res.json({ data: [], count: 0, limit, offset });
  }
});

// ── PATCH /admin/orgs/:id/status — Suspend / Reactivate / Disable ──
adminRouter.patch('/orgs/:id/status',
  validate(z.object({
    status: z.enum(['active', 'suspended', 'disabled']),
  })),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    const { data: org, error: fetchError } = await adminClient
      .from('organizations')
      .select('id, name, status')
      .eq('id', id)
      .single();

    if (fetchError || !org) throw new AppError(404, 'Organization not found');
    if (org.status === status) throw new AppError(400, `Organization is already ${status}`);

    const { error: updateError } = await adminClient
      .from('organizations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw new AppError(500, updateError.message);

    await adminClient.from('audit_log').insert({
      admin_id: req.user!.id,
      action: 'update_org_status',
      entity_type: 'organizations',
      entity_id: id,
      details: { from: org.status, to: status },
    });

    res.json({ data: { id, name: org.name, previous_status: org.status, status } });
  }
);

// ── GET /admin/roles ──
adminRouter.get('/roles', async (_req: Request, res: Response) => {
  const { data, error } = await adminClient
    .from('roles')
    .select('*')
    .order('scope')
    .order('name');
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ── POST /admin/roles ──
adminRouter.post('/roles',
  validate(z.object({
    name: z.string().min(1).max(100),
    scope: z.enum(['platform', 'org']),
    description: z.string().optional().default(''),
    permissions: z.record(z.boolean()).optional().default({}),
  })),
  async (req: Request, res: Response) => {
    const { name, scope, description, permissions } = req.body;
    const { data, error } = await adminClient
      .from('roles')
      .insert({ name, scope, description: description || null, permissions, is_system_role: false })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new AppError(409, `Role "${name}" with scope "${scope}" already exists`);
      throw new AppError(500, error.message);
    }
    res.status(201).json({ data });
  }
);

// ── PATCH /admin/roles/:id ──
adminRouter.patch('/roles/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body;

  // Prevent renaming/descoping system roles
  if (body.name || body.scope) {
    const { data: existing } = await adminClient.from('roles').select('is_system_role').eq('id', id).single();
    if (existing?.is_system_role) throw new AppError(403, 'Cannot rename or change scope of system roles');
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.scope !== undefined) updates.scope = body.scope;
  if (body.description !== undefined) updates.description = body.description;
  if (body.permissions !== undefined) updates.permissions = body.permissions;
  if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update');
  updates.updated_at = new Date().toISOString();

  const { data, error } = await adminClient.from('roles').update(updates).eq('id', id).select().single();
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ── DELETE /admin/roles/:id ──
adminRouter.delete('/roles/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const { data: existing } = await adminClient.from('roles').select('is_system_role').eq('id', id).single();
  if (!existing) throw new AppError(404, 'Role not found');
  if (existing.is_system_role) throw new AppError(403, 'Cannot delete system roles');

  const { data, error } = await adminClient.from('roles').delete().eq('id', id).select().single();
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ════════════════════════════════════════
// VERIFICATIONS (B2B)
// ════════════════════════════════════════

// ── GET /admin/verifications ──
// Returns all org verification submissions across all orgs, enriched with org name
adminRouter.get('/verifications', async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    let query = adminClient
      .from('org_verifications')
      .select('*', { count: 'exact' });

    if (status) query = query.eq('status', status);

    const { data: verifications, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      // If table doesn't exist, return empty
      if (error.code === '42P01') {
        return res.json({ data: [], count: 0, limit, offset });
      }
      throw new AppError(500, error.message);
    }

    // Enrich with org names
    const orgIds = [...new Set((verifications || []).map((v: any) => v.org_id))];
    let orgMap = new Map<string, { name: string; slug: string }>();

    if (orgIds.length > 0) {
      const { data: orgs } = await adminClient
        .from('organizations')
        .select('id, name, slug')
        .in('id', orgIds);
      if (orgs) {
        orgMap = new Map(orgs.map((o: any) => [o.id, { name: o.name, slug: o.slug }]));
      }
    }

    const data = (verifications || []).map((v: any) => ({
      ...v,
      organization: orgMap.get(v.org_id) || null,
    }));

    res.json({ data, count, limit, offset });
  } catch (err) {
    // If table doesn't exist at all, return empty
    if (err instanceof AppError) throw err;
    res.json({ data: [], count: 0, limit, offset });
  }
});

// ── PATCH /admin/verifications/:id/review ──
// Review (approve/reject) an org verification submission
adminRouter.patch('/verifications/:id/review',
  validate(z.object({
    status: z.enum(['verified', 'rejected']),
    notes: z.string().optional(),
  })),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    const { data: existing, error: fetchError } = await adminClient
      .from('org_verifications')
      .select('id, org_id, status')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === '42P01') throw new AppError(404, 'Verifications table does not exist');
      if (fetchError.code === 'PGRST116') throw new AppError(404, 'Verification not found');
      throw new AppError(500, fetchError.message);
    }

    if (existing.status === 'verified') throw new AppError(400, 'Verification is already verified');
    if (existing.status === 'rejected') throw new AppError(400, 'Verification is already rejected');

    const { data, error } = await adminClient
      .from('org_verifications')
      .update({
        status,
        reviewed_by: req.user?.id || null,
        reviewed_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(500, error.message);

    if (status === 'verified') {
      const { data: org } = await adminClient
        .from('organizations')
        .select('subscription_plan_id')
        .eq('id', existing.org_id)
        .single();

      const updates: Record<string, unknown> = { status: 'active' };

      if (!org?.subscription_plan_id) {
        const { data: freePlan } = await adminClient
          .from('subscription_plans')
          .select('id')
          .eq('slug', 'free')
          .maybeSingle();

        if (freePlan) {
          updates.subscription_plan_id = freePlan.id;
          updates.subscription_starts_at = new Date().toISOString();
        }
      }

      await adminClient
        .from('organizations')
        .update(updates)
        .eq('id', existing.org_id);
    }

    // Notify org members
    const { data: members } = await adminClient
      .from('org_members')
      .select('user_id')
      .eq('org_id', existing.org_id);

    if (members && members.length > 0) {
      const notifications = members.map((m: any) => ({
        profile_id: m.user_id,
        title: status === 'verified' ? 'Organization Verified' : 'Verification Rejected',
        message: status === 'verified'
          ? 'Your organization has been verified successfully. You now have access to all platform features.'
          : `Your organization verification was not approved.${notes ? ` Reason: ${notes}` : ''}`,
        type: 'system' as const,
      }));
      for (const n of notifications) {
        await adminClient.from('notifications').insert(n).maybeSingle();
      }
    }

    res.json({ data });
  }
);

// ════════════════════════════════════════
// BILLING — SUBSCRIPTION PLANS
// ════════════════════════════════════════

const planCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100),
  description: z.string().optional().default(''),
  price_monthly: z.number().min(0),
  price_yearly: z.number().min(0),
  features: z.array(z.string()).optional().default([]),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).optional().default(0),
});

const planUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  price_monthly: z.number().min(0).optional(),
  price_yearly: z.number().min(0).optional(),
  features: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

adminRouter.get('/billing/plans', async (_req: Request, res: Response) => {
  const { data, error } = await adminClient
    .from('subscription_plans')
    .select('*')
    .order('sort_order')
    .order('name');
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

adminRouter.post('/billing/plans',
  validate(planCreateSchema),
  async (req: Request, res: Response) => {
    const { data, error } = await adminClient
      .from('subscription_plans')
      .insert({
        name: req.body.name,
        slug: req.body.slug,
        description: req.body.description || null,
        price_monthly: req.body.price_monthly,
        price_yearly: req.body.price_yearly,
        features: req.body.features || [],
        is_active: req.body.is_active ?? true,
        sort_order: req.body.sort_order ?? 0,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new AppError(409, `Plan slug "${req.body.slug}" already exists`);
      throw new AppError(500, error.message);
    }
    res.status(201).json({ data });
  }
);

adminRouter.patch('/billing/plans/:id',
  validate(planUpdateSchema),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates: Record<string, unknown> = {};
    for (const f of ['name', 'slug', 'description', 'price_monthly', 'price_yearly', 'features', 'is_active', 'sort_order'] as const) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    if (Object.keys(updates).length === 0) throw new AppError(400, 'No valid fields to update');
    const { data, error } = await adminClient
      .from('subscription_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new AppError(409, `Plan slug "${req.body.slug}" already exists`);
      if (error.code === 'PGRST116') throw new AppError(404, 'Plan not found');
      throw new AppError(500, error.message);
    }
    res.json({ data });
  }
);

adminRouter.delete('/billing/plans/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data: orgsUsingPlan } = await adminClient
    .from('organizations')
    .select('id')
    .eq('subscription_plan_id', id)
    .limit(1);
  if (orgsUsingPlan && orgsUsingPlan.length > 0) {
    const { data, error } = await adminClient
      .from('subscription_plans')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new AppError(500, error.message);
    return res.json({ data, notice: 'Plan is in use — deactivated instead of deleted' });
  }
  const { data, error } = await adminClient
    .from('subscription_plans')
    .delete()
    .eq('id', id)
    .select()
    .single();
  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Plan not found');
    throw new AppError(500, error.message);
  }
  res.json({ data });
});

// ════════════════════════════════════════
// CONTRACTS (CROSS-ORG)
// ════════════════════════════════════════

adminRouter.get('/contracts', async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  let query = adminClient
    .from('contracts')
    .select('*, talent:talent_id(id, full_name, avatar_url, headline)', { count: 'exact' });

  if (status) query = query.eq('status', status);

  const { data: contracts, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new AppError(500, error.message);

  const orgIds = [...new Set((contracts || []).map((c: any) => c.org_id))];
  let orgMap = new Map<string, { name: string; slug: string }>();

  if (orgIds.length > 0) {
    const { data: orgs } = await adminClient
      .from('organizations')
      .select('id, name, slug')
      .in('id', orgIds);
    if (orgs) {
      orgMap = new Map(orgs.map((o: any) => [o.id, { name: o.name, slug: o.slug }]));
    }
  }

  const data = (contracts || []).map((c: any) => ({
    ...c,
    organization: orgMap.get(c.org_id) || null,
  }));

  res.json({ data, count, limit, offset });
});

// ════════════════════════════════════════
// BILLING — INVOICES & HISTORY (CROSS-ORG)
// ════════════════════════════════════════

adminRouter.get('/billing/invoices', async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    let query = adminClient
      .from('billing_invoices')
      .select('*', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (search) query = query.or(`invoice_number.ilike.%${search}%,org_id.ilike.%${search}%`);

    const { data: invoices, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01') {
        return res.json({ data: [], count: 0, limit, offset });
      }
      throw new AppError(500, error.message);
    }

    // Enrich with org names and plan names
    const orgIds = [...new Set((invoices || []).map((inv: any) => inv.org_id))];
    const planIds = [...new Set((invoices || []).map((inv: any) => inv.plan_id).filter(Boolean))];

    const [orgResult, planResult] = await Promise.all([
      orgIds.length > 0
        ? adminClient.from('organizations').select('id, name, slug').in('id', orgIds)
        : Promise.resolve({ data: [] }),
      planIds.length > 0
        ? adminClient.from('subscription_plans').select('id, name, slug').in('id', planIds)
        : Promise.resolve({ data: [] }),
    ]);

    const orgMap = new Map((orgResult.data || []).map((o: any) => [o.id, { name: o.name, slug: o.slug }]));
    const planMap = new Map((planResult.data || []).map((p: any) => [p.id, { name: p.name, slug: p.slug }]));

    const data = (invoices || []).map((inv: any) => ({
      ...inv,
      organization: orgMap.get(inv.org_id) || null,
      plan: planMap.get(inv.plan_id) || null,
    }));

    res.json({ data, count, limit, offset });
  } catch (err) {
    if (err instanceof AppError) throw err;
    res.json({ data: [], count: 0, limit, offset });
  }
});

adminRouter.get('/billing/history', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    let query = adminClient
      .from('billing_history')
      .select('*', { count: 'exact' });

    const { data: history, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (error.code === '42P01') {
        return res.json({ data: [], count: 0, limit, offset });
      }
      throw new AppError(500, error.message);
    }

    // Enrich with org names, plan names, and changer info
    const orgIds = [...new Set((history || []).map((h: any) => h.org_id))];
    const planIds = [...new Set([...(history || []).map((h: any) => h.from_plan_id), ...(history || []).map((h: any) => h.to_plan_id)].filter(Boolean))];
    const userIds = [...new Set((history || []).map((h: any) => h.changed_by).filter(Boolean))];

    const [orgResult, planResult, userResult] = await Promise.all([
      orgIds.length > 0
        ? adminClient.from('organizations').select('id, name, slug').in('id', orgIds)
        : Promise.resolve({ data: [] }),
      planIds.length > 0
        ? adminClient.from('subscription_plans').select('id, name, slug').in('id', planIds)
        : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? adminClient.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
        : Promise.resolve({ data: [] }),
    ]);

    const orgMap = new Map((orgResult.data || []).map((o: any) => [o.id, { name: o.name, slug: o.slug }]));
    const planMap = new Map((planResult.data || []).map((p: any) => [p.id, { name: p.name, slug: p.slug }]));
    const userMap = new Map((userResult.data || []).map((u: any) => [u.id, { full_name: u.full_name, avatar_url: u.avatar_url }]));

    const data = (history || []).map((h: any) => ({
      ...h,
      organization: orgMap.get(h.org_id) || null,
      from_plan: planMap.get(h.from_plan_id) || null,
      to_plan: planMap.get(h.to_plan_id) || null,
      changed_by_user: userMap.get(h.changed_by) || null,
    }));

    res.json({ data, count, limit, offset });
  } catch (err) {
    if (err instanceof AppError) throw err;
    res.json({ data: [], count: 0, limit, offset });
  }
});

// ════════════════════════════════════════
// COMPLIANCE REPORTS (CROSS-ORG)
// ════════════════════════════════════════

adminRouter.get('/compliance/reports', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    let query = adminClient
      .from('compliance_reports')
      .select('*', { count: 'exact' });

    const { data: reports, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (error.code === '42P01') {
        return res.json({ data: [], count: 0, limit, offset });
      }
      throw new AppError(500, error.message);
    }

    // Enrich with org names
    const orgIds = [...new Set((reports || []).map((r: any) => r.org_id))];
    let orgMap = new Map<string, { name: string; slug: string }>();

    if (orgIds.length > 0) {
      const { data: orgs } = await adminClient
        .from('organizations')
        .select('id, name, slug')
        .in('id', orgIds);
      if (orgs) {
        orgMap = new Map(orgs.map((o: any) => [o.id, { name: o.name, slug: o.slug }]));
      }
    }

    const data = (reports || []).map((r: any) => ({
      ...r,
      organization: orgMap.get(r.org_id) || null,
    }));

    res.json({ data, count, limit, offset });
  } catch (err) {
    if (err instanceof AppError) throw err;
    res.json({ data: [], count: 0, limit, offset });
  }
});

// ════════════════════════════════════════
// HIRING — CROSS-ORG JOB POSTS & APPLICATIONS
// ════════════════════════════════════════

adminRouter.get('/jobs', async (req: Request, res: Response) => {
  const search = req.query.search as string | undefined;
  const type = req.query.type as string | undefined;
  const status = req.query.status as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    let query = adminClient
      .from('jobs')
      .select('*', { count: 'exact' });

    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    if (type && type !== 'all') query = query.eq('type', type);
    if (status === 'active') query = query.eq('is_active', true);
    else if (status === 'inactive') query = query.eq('is_active', false);

    const { data: jobs, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (error.code === '42P01') {
        return res.json({ data: [], count: 0, limit, offset });
      }
      throw new AppError(500, error.message);
    }

    const orgIds = [...new Set((jobs || []).map((j: any) => j.org_id).filter(Boolean))];
    const companyIds = [...new Set((jobs || []).map((j: any) => j.company_id).filter(Boolean))];

    const [orgResult, companyResult] = await Promise.all([
      orgIds.length > 0
        ? adminClient.from('organizations').select('id, name, slug').in('id', orgIds)
        : Promise.resolve({ data: [] }),
      companyIds.length > 0
        ? adminClient.from('profiles').select('id, full_name, company_name, avatar_url').in('id', companyIds)
        : Promise.resolve({ data: [] }),
    ]);

    const orgMap = new Map((orgResult.data || []).map((o: any) => [o.id, { name: o.name, slug: o.slug }]));
    const companyMap = new Map((companyResult.data || []).map((p: any) => [p.id, { full_name: p.full_name, company_name: p.company_name, avatar_url: p.avatar_url }]));

    const data = (jobs || []).map((j: any) => ({
      ...j,
      organization: orgMap.get(j.org_id) || null,
      company: companyMap.get(j.company_id) || null,
    }));

    res.json({ data, count, limit, offset });
  } catch (err) {
    if (err instanceof AppError) throw err;
    res.json({ data: [], count: 0, limit, offset });
  }
});

adminRouter.get('/applications', async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    let query = adminClient
      .from('applications')
      .select('*', { count: 'exact' });

    if (status) query = query.eq('status', status);

    const { data: applications, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (error.code === '42P01') {
        return res.json({ data: [], count: 0, limit, offset });
      }
      throw new AppError(500, error.message);
    }

    const jobIds = [...new Set((applications || []).map((a: any) => a.job_id).filter(Boolean))];
    const studentIds = [...new Set((applications || []).map((a: any) => a.student_id).filter(Boolean))];

    const [jobResult, studentResult] = await Promise.all([
      jobIds.length > 0
        ? adminClient.from('jobs').select('id, title, type, company_id, org_id, is_active').in('id', jobIds)
        : Promise.resolve({ data: [] }),
      studentIds.length > 0
        ? adminClient.from('profiles').select('id, full_name, avatar_url').in('id', studentIds)
        : Promise.resolve({ data: [] }),
    ]);

    const jobs = jobResult.data || [];
    const orgIds = [...new Set(jobs.map((j: any) => j.org_id).filter(Boolean))];

    const { data: orgs } = orgIds.length > 0
      ? await adminClient.from('organizations').select('id, name, slug').in('id', orgIds)
      : { data: [] };

    const orgMap = new Map((orgs || []).map((o: any) => [o.id, { name: o.name, slug: o.slug }]));
    const jobMap = new Map(jobs.map((j: any) => [j.id, { ...j, organization: orgMap.get(j.org_id) || null }]));
    const studentMap = new Map((studentResult.data || []).map((s: any) => [s.id, { full_name: s.full_name, avatar_url: s.avatar_url }]));

    const data = (applications || []).map((a: any) => ({
      ...a,
      job: jobMap.get(a.job_id) || null,
      student: studentMap.get(a.student_id) || null,
    }));

    res.json({ data, count, limit, offset });
  } catch (err) {
    if (err instanceof AppError) throw err;
    res.json({ data: [], count: 0, limit, offset });
  }
});

// ════════════════════════════════════════
// MESSAGING — ADMIN MONITORING
// ════════════════════════════════════════

/** GET /admin/conversations — list all conversations with participant info */
adminRouter.get('/conversations', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const search = req.query.search as string | undefined;

  let query = adminClient
    .from('conversations')
    .select('*', { count: 'exact' })
    .order('last_message_at', { ascending: false });

  const { data: convs, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new AppError(500, error.message);

  const convIds = (convs || []).map((c: any) => c.id);
  let partsByConv = new Map<string, any[]>();
  if (convIds.length > 0) {
    const { data: parts } = await adminClient
      .from('conversation_participants')
      .select('conversation_id, profile_id')
      .in('conversation_id', convIds);
    if (parts) {
      for (const p of parts) {
        const arr = partsByConv.get(p.conversation_id) || [];
        arr.push(p.profile_id);
        partsByConv.set(p.conversation_id, arr);
      }
    }
  }

  const allProfileIds = new Set<string>();
  for (const [, pids] of partsByConv) {
    for (const pid of pids) allProfileIds.add(pid);
  }
  let profileMap = new Map<string, any>();
  if (allProfileIds.size > 0) {
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, full_name, avatar_url, email')
      .in('id', Array.from(allProfileIds));
    if (profiles) {
      for (const p of profiles) profileMap.set(p.id, p);
    }
  }

  const data = (convs || []).map((conv: any) => {
    const participantIds = partsByConv.get(conv.id) || [];
    const participants = participantIds.map((pid: string) => profileMap.get(pid)).filter(Boolean);
    return { ...conv, participants };
  });

  res.json({ data, count, limit, offset });
});

/** GET /admin/conversations/:id/messages — view all messages in a conversation */
adminRouter.get('/conversations/:id/messages', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await adminClient
    .from('messages')
    .select('*, message_attachments(*)')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });
  if (error) throw new AppError(500, error.message);

  const senderIds = [...new Set((data || []).map((m: any) => m.sender_id))];
  let senderMap = new Map<string, any>();
  if (senderIds.length > 0) {
    const { data: senders } = await adminClient
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', senderIds);
    if (senders) {
      for (const s of senders) senderMap.set(s.id, s);
    }
  }

  const enriched = (data || []).map((m: any) => ({
    ...m,
    sender: senderMap.get(m.sender_id) || null,
  }));

  res.json({ data: enriched });
});

/** DELETE /admin/conversations/:id/messages/:msgId — delete an inappropriate message */
adminRouter.delete('/conversations/:id/messages/:msgId', async (req: Request, res: Response) => {
  const { id, msgId } = req.params;

  const { data: existing } = await adminClient
    .from('messages')
    .select('id, conversation_id')
    .eq('id', msgId)
    .eq('conversation_id', id)
    .single();
  if (!existing) throw new AppError(404, 'Message not found');

  const { error } = await adminClient.from('messages').delete().eq('id', msgId);
  if (error) throw new AppError(500, error.message);

  res.json({ data: { id: msgId, deleted: true } });
});

// ════════════════════════════════════════
// BILLING — PAYMENT MANAGEMENT
// ════════════════════════════════════════

// GET /admin/billing/payments — list all payments (with org+plan info)
adminRouter.get('/billing/payments', async (req: Request, res: Response) => {
  const statusFilter = req.query.status as string | undefined;
  let query = adminClient
    .from('billing_payments')
    .select('*, org:org_id(id, name), plan:plan_id(id, name, slug), reviewed_by_profile:reviewed_by(id, full_name)')
    .order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);
  const { data, error } = await query;
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// PATCH /admin/billing/payments/:id/approve — approve an offline payment
adminRouter.patch('/billing/payments/:id/approve', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { admin_notes } = req.body || {};

  const { data: payment } = await adminClient.from('billing_payments').select('*, plan:plan_id(id, name, slug)').eq('id', id).single();
  if (!payment) throw new AppError(404, 'Payment not found');
  if (payment.status !== 'pending') throw new AppError(400, 'Payment already processed');

  // Approve the payment
  const { data, error } = await adminClient
    .from('billing_payments')
    .update({ status: 'approved', reviewed_by: req.user?.id, reviewed_at: new Date().toISOString(), admin_notes: admin_notes || null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new AppError(500, error.message);

  // Activate the plan for the org
  await adminClient.from('organizations').update({
    subscription_plan_id: payment.plan_id,
    subscription_starts_at: new Date().toISOString(),
    subscription_ends_at: null,
  }).eq('id', payment.org_id);

  // Log billing history
  await adminClient.from('billing_history').insert({
    org_id: payment.org_id,
    to_plan_id: payment.plan_id,
    change_type: 'plan_change',
    amount: payment.amount,
    billing_cycle: 'monthly',
    changed_by: req.user?.id,
  }).maybeSingle();

  res.json({ data });
});

// PATCH /admin/billing/payments/:id/reject — reject an offline payment
adminRouter.patch('/billing/payments/:id/reject', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { admin_notes } = req.body || {};

  const { data: payment } = await adminClient.from('billing_payments').select('*').eq('id', id).single();
  if (!payment) throw new AppError(404, 'Payment not found');
  if (payment.status !== 'pending') throw new AppError(400, 'Payment already processed');

  const { data, error } = await adminClient
    .from('billing_payments')
    .update({ status: 'rejected', reviewed_by: req.user?.id, reviewed_at: new Date().toISOString(), admin_notes: admin_notes || null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new AppError(500, error.message);

  res.json({ data });
});

// ── Connections Management ──

adminRouter.get('/connections', async (_req: Request, res: Response) => {
  const { data, error } = await adminClient
    .from('connections')
    .select('*, follower:profiles!follower_id(id, full_name, email, avatar_url, role, headline), following:profiles!following_id(id, full_name, email, avatar_url, role, headline)')
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  res.json({ data, count: data?.length || 0 });
});

adminRouter.get('/connections/duplicates', async (_req: Request, res: Response) => {
  const { data, error } = await adminClient
    .from('connections')
    .select('*, follower:profiles!follower_id(id, full_name, email), following:profiles!following_id(id, full_name, email)')
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, error.message);

  const seen = new Map<string, typeof data>();
  const duplicates: Array<{ key: string; user1: string; user2: string; count: number; rows: typeof data }> = [];

  for (const row of data || []) {
    const a = row.follower_id < row.following_id ? row.follower_id : row.following_id;
    const b = row.follower_id < row.following_id ? row.following_id : row.follower_id;
    const key = `${a}::${b}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(row);
  }

  for (const [key, rows] of seen) {
    if (rows.length > 1) {
      const [a, b] = key.split('::');
      const user1 = rows[0]?.follower?.full_name || a;
      const user2 = rows[0]?.following?.full_name || b;
      duplicates.push({ key, user1, user2, count: rows.length, rows });
    }
  }

  res.json({ data: duplicates, count: duplicates.length });
});

adminRouter.delete('/connections/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await adminClient.from('connections').delete().eq('id', id).select().single();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Connection not found');
  res.json({ data });
});

adminRouter.post('/connections/deduplicate', async (_req: Request, res: Response) => {
  const { data: all, error: fetchErr } = await adminClient
    .from('connections')
    .select('id, follower_id, following_id, created_at')
    .order('created_at', { ascending: true });

  if (fetchErr) throw new AppError(500, fetchErr.message);

  const seen = new Map<string, string[]>();
  for (const row of all || []) {
    const a = row.follower_id < row.following_id ? row.follower_id : row.following_id;
    const b = row.follower_id < row.following_id ? row.following_id : row.follower_id;
    const key = `${a}::${b}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(row.id);
  }

  let removedCount = 0;
  for (const [, ids] of seen) {
    if (ids.length > 1) {
      const [, ...toRemove] = ids;
      const { error: delErr } = await adminClient.from('connections').delete().in('id', toRemove);
      if (!delErr) removedCount += toRemove.length;
    }
  }

  res.json({ data: { removed: removedCount } });
});

// ── Admin Conversations Management ──

adminRouter.get('/conversations', async (_req: Request, res: Response) => {
  const { data: convs, error } = await adminClient
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  res.json({ data: convs || [] });
});

adminRouter.get('/conversations/:id/messages', async (req: Request, res: Response) => {
  const { data: msgs, error } = await adminClient
    .from('messages')
    .select('*, message_attachments(*)')
    .eq('conversation_id', req.params.id)
    .order('created_at', { ascending: true });
  if (error) throw new AppError(500, error.message);
  res.json({ data: msgs || [] });
});
