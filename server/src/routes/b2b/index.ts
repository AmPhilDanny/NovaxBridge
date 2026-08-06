import { Router, Request, Response } from 'express';
import multer from 'multer';
import { adminClient } from '../../lib/supabase-admin.js';
import { AppError } from '../../middleware/error.js';
import { requirePermission } from '../../middleware/auth.js';

const verificationUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const b2bRouter: Router = Router();

// All B2B routes require access_b2b permission on the user's platform role
b2bRouter.use(requirePermission('access_b2b'));

const ORG_ADMIN_ROLES = ['owner', 'admin'] as const;
const ORG_MANAGER_ROLES = ['owner', 'admin', 'manager'] as const;
const ORG_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'] as const;
const INVITE_ROLES = ['admin', 'manager', 'member', 'viewer'] as const;
const APPLICATION_STATUSES = ['pending', 'reviewed', 'interviewed', 'offer', 'accepted', 'rejected'] as const;
const CONTRACT_TYPES = ['msa', 'sow', 'fixed_price', 'milestone_based'] as const;
const BILLING_CYCLES = ['monthly', 'yearly'] as const;
const CONTRACT_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['signed', 'cancelled'],
  signed: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// ── Helpers ──

async function getUserOrg(userId: string) {
  const { data: userData } = await adminClient.auth.admin.getUserById(userId);
  const currentOrgId = (userData?.user?.app_metadata as Record<string, any>)?.current_org_id;

  let query = adminClient
    .from('org_members')
    .select('org_id, role, organizations:org_id(*)')
    .eq('user_id', userId);
  if (currentOrgId) query = query.eq('org_id', currentOrgId);

  const { data: member } = await query.maybeSingle();
  if (!member) return null;
  return { org: member.organizations as Record<string, any>, role: member.role };
}

function requireRole(role: string, allowed: readonly string[]): void {
  if (!allowed.includes(role as any)) throw new AppError(403, 'Insufficient permissions');
}

async function logAudit(adminId: string, action: string, entityType: string, entityId?: string, details?: Record<string, unknown>) {
  try {
    await adminClient.from('admin_audit_log').insert({ admin_id: adminId, action, entity_type: entityType, entity_id: entityId, details: details || {} });
  } catch { /* non-fatal */ }
}

// ════════════════════════════════════════
// ORG
// ════════════════════════════════════════

// GET /org
b2bRouter.get('/org', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  res.json(userOrg);
});

// POST /org — create organization
b2bRouter.post('/org', async (req: Request, res: Response) => {
  const { name, industry, size, description, website_url, country, city, address } = req.body;
  if (!name) throw new AppError(400, 'Organization name is required');

  const existing = await getUserOrg(req.user!.id);
  if (existing) throw new AppError(409, 'User already belongs to an organization');

  const { data: freePlan } = await adminClient.from('subscription_plans').select('id').eq('slug', 'free').single();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + req.user!.id.substring(0, 8);

  const { data: org, error: orgErr } = await adminClient
    .from('organizations')
    .insert({ name, slug, industry: industry || null, size: size || null, description: description || null, website_url: website_url || null, country: country || null, city: city || null, address: address || null, subscription_plan_id: freePlan?.id || null, subscription_starts_at: new Date().toISOString() })
    .select()
    .single();
  if (orgErr) throw new AppError(500, orgErr.message);

  const { error: memberErr } = await adminClient.from('org_members').insert({ org_id: org.id, user_id: req.user!.id, role: 'owner' });
  if (memberErr) throw new AppError(500, memberErr.message);

  await logAudit(req.user!.id, 'create_org', 'organizations', org.id, { name });
  res.status(201).json({ data: org });
});

// PATCH /org
b2bRouter.patch('/org', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  requireRole(userOrg.role, ORG_ADMIN_ROLES);

  const body = req.body;
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.industry !== undefined) updates.industry = body.industry;
  if (body.size !== undefined) updates.size = body.size;
  if (body.description !== undefined) updates.description = body.description;
  if (body.logo_url !== undefined) updates.logo_url = body.logo_url;
  if (body.website_url !== undefined) updates.website_url = body.website_url;
  if (body.country !== undefined) updates.country = body.country;
  if (body.city !== undefined) updates.city = body.city;
  if (body.address !== undefined) updates.address = body.address;
  if (Object.keys(updates).length === 0) throw new AppError(400, 'No fields to update');

  const { data: org, error } = await adminClient.from('organizations').update(updates).eq('id', userOrg.org.id).select().single();
  if (error) throw new AppError(500, error.message);
  await logAudit(req.user!.id, 'update_org', 'organizations', org.id, updates);
  res.json({ data: org });
});

// GET /org/members
b2bRouter.get('/org/members', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');

  const { data: members, error } = await adminClient
    .from('org_members')
    .select('id, role, user_id, title, joined_at, created_at')
    .eq('org_id', userOrg.org.id)
    .order('joined_at');
  if (error) throw new AppError(500, error.message);

  // Fetch user profiles separately (no FK relationship on user_id in schema)
  if (members && members.length > 0) {
    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, full_name, avatar_url, email, role')
      .in('id', userIds);
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const enriched = members.map(m => ({
      ...m,
      user: profileMap.get(m.user_id) || null,
    }));
    return res.json({ data: enriched });
  }

  res.json({ data: members || [] });
});

// POST /org/members/invite
b2bRouter.post('/org/members/invite', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  requireRole(userOrg.role, ORG_ADMIN_ROLES);

  const { email, role: inviteRole, message } = req.body;
  if (!email || !inviteRole) throw new AppError(400, 'Email and role are required');
  if (!INVITE_ROLES.includes(inviteRole as any)) throw new AppError(400, 'Invalid role');

  const { data: existingInvite } = await adminClient.from('org_invites').select('id, status').eq('org_id', userOrg.org.id).eq('email', email).eq('status', 'pending').maybeSingle();
  if (existingInvite) throw new AppError(409, 'A pending invite already exists for this email');

  const { data: invite, error } = await adminClient.from('org_invites').insert({ org_id: userOrg.org.id, email, role: inviteRole, invited_by: req.user!.id, message: message || null }).select().single();
  if (error) throw new AppError(500, error.message);
  await logAudit(req.user!.id, 'invite_member', 'org_invites', invite.id, { email, role: inviteRole });
  res.status(201).json({ data: invite });
});

// POST /org/invites/accept
b2bRouter.post('/org/invites/accept', async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) throw new AppError(400, 'Invite token required');

  const { data: invite } = await adminClient.from('org_invites').select('*, organizations!inner(name)').eq('token', token).single();
  if (!invite) throw new AppError(404, 'Invalid or expired invite token');
  if (invite.status !== 'pending') throw new AppError(400, `Invite already ${invite.status}`);
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    await adminClient.from('org_invites').update({ status: 'expired' }).eq('id', invite.id);
    throw new AppError(400, 'Invite has expired');
  }

  const { data: existing } = await adminClient.from('org_members').select('id').eq('org_id', invite.org_id).eq('user_id', req.user!.id).maybeSingle();
  if (existing) throw new AppError(409, 'Already a member');

  const { data: member, error } = await adminClient.from('org_members').insert({ org_id: invite.org_id, user_id: req.user!.id, role: invite.role }).select().single();
  if (error) throw new AppError(500, error.message);

  await adminClient.from('org_invites').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', invite.id);
  await logAudit(req.user!.id, 'accept_invite', 'org_members', member.id, { org_id: invite.org_id, org_name: (invite as any).organizations?.name, role: invite.role });
  res.json({ data: member });
});

// GET /org/memberships
b2bRouter.get('/org/memberships', async (req: Request, res: Response) => {
  const { data, error } = await adminClient.from('org_members').select('org_id, role, organizations:org_id(id, name, slug, logo_url)').eq('user_id', req.user!.id);
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// POST /org/switch
b2bRouter.post('/org/switch', async (req: Request, res: Response) => {
  const { org_id } = req.body;
  if (!org_id) throw new AppError(400, 'org_id required');

  const { data: membership } = await adminClient.from('org_members').select('id, role').eq('org_id', org_id).eq('user_id', req.user!.id).maybeSingle();
  if (!membership) throw new AppError(403, 'Not a member of this organization');

  const { error: updateErr } = await adminClient.auth.admin.updateUserById(req.user!.id, { app_metadata: { current_org_id: org_id } });
  if (updateErr) throw new AppError(500, updateErr.message);
  res.json({ data: { org_id, role: membership.role } });
});

// PATCH /org/members/:id/role
b2bRouter.patch('/org/members/:id/role', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  requireRole(userOrg.role, ORG_ADMIN_ROLES);

  const { role: newRole } = req.body;
  if (!ORG_ROLES.includes(newRole as any)) throw new AppError(400, 'Invalid role');

  const { data: target } = await adminClient.from('org_members').select('id, role, user_id').eq('id', req.params.id).eq('org_id', userOrg.org.id).single();
  if (!target) throw new AppError(404, 'Member not found');
  if (target.role === 'owner' && userOrg.role !== 'owner') throw new AppError(403, 'Only owners can change owner role');

  const { data, error } = await adminClient.from('org_members').update({ role: newRole }).eq('id', req.params.id).select().single();
  if (error) throw new AppError(500, error.message);
  await logAudit(req.user!.id, 'change_member_role', 'org_members', req.params.id as string, { new_role: newRole });
  res.json({ data });
});

// GET /org/invites
b2bRouter.get('/org/invites', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  const { data, error } = await adminClient.from('org_invites').select('*, inviter:invited_by(id, full_name, avatar_url)').eq('org_id', userOrg.org.id).order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// DELETE /org/invites/:id (cancel)
b2bRouter.delete('/org/invites/:id', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  requireRole(userOrg.role, ORG_ADMIN_ROLES);
  const { error } = await adminClient.from('org_invites').update({ status: 'cancelled' }).eq('id', req.params.id).eq('org_id', userOrg.org.id);
  if (error) throw new AppError(500, error.message);
  res.json({ success: true });
});

// DELETE /org/members/:id
b2bRouter.delete('/org/members/:id', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  requireRole(userOrg.role, ORG_ADMIN_ROLES);

  const { data: targetMember } = await adminClient.from('org_members').select('id, role, user_id').eq('id', req.params.id).eq('org_id', userOrg.org.id).single();
  if (!targetMember) throw new AppError(404, 'Member not found');

  if (targetMember.role === 'owner') {
    const { count } = await adminClient.from('org_members').select('id', { count: 'exact', head: true }).eq('org_id', userOrg.org.id).eq('role', 'owner');
    if (count && count <= 1) throw new AppError(403, 'Cannot remove the last owner');
  }

  const { error } = await adminClient.from('org_members').delete().eq('id', req.params.id);
  if (error) throw new AppError(500, error.message);
  await logAudit(req.user!.id, 'remove_member', 'org_members', req.params.id as string);
  res.json({ success: true });
});

// ════════════════════════════════════════
// SUBSCRIPTION
// ════════════════════════════════════════

// GET /subscription
b2bRouter.get('/subscription', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  const org = userOrg.org;

  if (!org.subscription_plan_id) {
    const { data: freePlan } = await adminClient.from('subscription_plans').select('*').eq('slug', 'free').single();
    return res.json({ plan: freePlan, status: 'active', starts_at: org.subscription_starts_at, ends_at: null });
  }

  const { data: plan } = await adminClient.from('subscription_plans').select('*').eq('id', org.subscription_plan_id).single();
  const isExpired = org.subscription_ends_at && new Date(org.subscription_ends_at) < new Date();
  res.json({ plan, status: isExpired ? 'expired' : 'active', starts_at: org.subscription_starts_at, ends_at: org.subscription_ends_at });
});

// POST /subscription/change
b2bRouter.post('/subscription/change', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  requireRole(userOrg.role, ORG_ADMIN_ROLES);

  const { plan_slug, billing_cycle } = req.body;
  if (!plan_slug || !BILLING_CYCLES.includes(billing_cycle || 'monthly' as any)) throw new AppError(400, 'plan_slug and billing_cycle required');

  const { data: plan } = await adminClient.from('subscription_plans').select('id, price_monthly, price_yearly').eq('slug', plan_slug).eq('is_active', true).single();
  if (!plan) throw new AppError(400, 'Invalid or inactive plan');

  const price = billing_cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
  const org = userOrg.org;

  const { data: updated, error } = await adminClient.from('organizations').update({
    subscription_plan_id: plan.id,
    subscription_starts_at: new Date().toISOString(),
    subscription_ends_at: price === 0 ? null : new Date(Date.now() + (billing_cycle === 'yearly' ? 365 : 30) * 86400000).toISOString(),
  }).eq('id', org.id).select().single();

  if (error) throw new AppError(500, error.message);
  await logAudit(req.user!.id, 'change_subscription', 'organizations', org.id, { plan_slug, billing_cycle, price });

  await adminClient.from('billing_history').insert({
    org_id: org.id, from_plan_id: org.subscription_plan_id, to_plan_id: plan.id,
    change_type: 'plan_change', amount: price, billing_cycle, changed_by: req.user!.id,
  }).maybeSingle();

  res.json({ data: updated });
});

// ════════════════════════════════════════
// TALENT SEARCH
// ════════════════════════════════════════

// GET /talent/search
b2bRouter.get('/talent/search', async (req: Request, res: Response) => {
  const skills = req.query.skills as string | undefined;
  const location = req.query.location as string | undefined;
  const availability = req.query.availability as string | undefined;
  const search = req.query.q as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const offset = parseInt(req.query.offset as string) || 0;

  let query = adminClient.from('profiles').select('*', { count: 'exact' }).eq('role', 'student').order('created_at', { ascending: false });
  if (search) query = query.or(`full_name.ilike.%${search}%,headline.ilike.%${search}%,bio.ilike.%${search}%`);
  if (skills) for (const skill of skills.split(',').map(s => s.trim())) query = query.contains('skills', [skill]);
  if (location) query = query.ilike('location', `%${location}%`);
  if (availability && ['open_to_work', 'open_to_collab', 'not_available'].includes(availability)) query = query.eq('availability', availability);

  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) throw new AppError(500, error.message);
  res.json({ data, count, limit, offset });
});

// GET /talent/saved-searches
b2bRouter.get('/talent/saved-searches', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  const { data, error } = await adminClient.from('saved_searches').select('*').eq('org_id', userOrg.org.id).eq('saved_by', req.user!.id).order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// POST /talent/saved-searches
b2bRouter.post('/talent/saved-searches', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  const { name, filters } = req.body;
  if (!name) throw new AppError(400, 'Name is required');
  const { data, error } = await adminClient.from('saved_searches').insert({ org_id: userOrg.org.id, saved_by: req.user!.id, name, filters: filters || {} }).select().single();
  if (error) throw new AppError(500, error.message);
  res.status(201).json({ data });
});

// DELETE /talent/saved-searches/:id
b2bRouter.delete('/talent/saved-searches/:id', async (req: Request, res: Response) => {
  const { error } = await adminClient.from('saved_searches').delete().eq('id', req.params.id).eq('saved_by', req.user!.id);
  if (error) throw new AppError(500, error.message);
  res.json({ success: true });
});

// GET /talent/lists
b2bRouter.get('/talent/lists', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  const { data, error } = await adminClient.from('talent_lists').select('*, saved_talent(count), created_by(id, full_name, avatar_url)').eq('org_id', userOrg.org.id).order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// POST /talent/lists
b2bRouter.post('/talent/lists', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  const { name, description } = req.body;
  if (!name) throw new AppError(400, 'Name is required');
  const { data, error } = await adminClient.from('talent_lists').insert({ org_id: userOrg.org.id, name, description: description || null, created_by: req.user!.id }).select().single();
  if (error) {
    if (error.code === '23505') throw new AppError(409, 'A list with this name already exists');
    throw new AppError(500, error.message);
  }
  res.status(201).json({ data });
});

// DELETE /talent/lists/:id
b2bRouter.delete('/talent/lists/:id', async (req: Request, res: Response) => {
  const { error } = await adminClient.from('talent_lists').delete().eq('id', req.params.id);
  if (error) throw new AppError(500, error.message);
  res.json({ success: true });
});

// GET /talent/lists/:id/talent
b2bRouter.get('/talent/lists/:id/talent', async (req: Request, res: Response) => {
  const { data, error } = await adminClient.from('saved_talent').select('*, talent: talent_id(id, full_name, avatar_url, headline, skills, location, availability)').eq('list_id', req.params.id).order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// POST /talent/lists/:id/talent
b2bRouter.post('/talent/lists/:id/talent', async (req: Request, res: Response) => {
  const { talent_id, notes } = req.body;
  if (!talent_id) throw new AppError(400, 'talent_id is required');
  const { data, error } = await adminClient.from('saved_talent').insert({ list_id: req.params.id, talent_id, notes: notes || null, saved_by: req.user!.id }).select().single();
  if (error) {
    if (error.code === '23505') throw new AppError(409, 'Talent already in this list');
    throw new AppError(500, error.message);
  }
  res.status(201).json({ data });
});

// DELETE /talent/lists/:id/talent/:talentId
b2bRouter.delete('/talent/lists/:id/talent/:talentId', async (req: Request, res: Response) => {
  const { error } = await adminClient.from('saved_talent').delete().eq('list_id', req.params.id).eq('talent_id', req.params.talentId);
  if (error) throw new AppError(500, error.message);
  res.json({ success: true });
});

// ════════════════════════════════════════
// JOBS & HIRING
// ════════════════════════════════════════

// POST /jobs/bulk
b2bRouter.post('/jobs/bulk', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  requireRole(userOrg.role, ORG_MANAGER_ROLES);

  const { jobs } = req.body;
  if (!jobs || !Array.isArray(jobs) || jobs.length === 0) throw new AppError(400, 'jobs array required');
  if (jobs.length > 50) throw new AppError(400, 'Maximum 50 jobs per batch');

  const orgId = userOrg.org.id;
  const results: { success: boolean; job?: any; error?: string }[] = [];
  const validJobs: any[] = [];

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    if (!job.title || !job.description || !job.type) {
      results.push({ success: false, error: `Row ${i + 1}: Missing required fields` });
      continue;
    }
    if (!['part-time', 'internship'].includes(job.type)) {
      results.push({ success: false, error: `Row ${i + 1}: Invalid type` });
      continue;
    }
    validJobs.push({
      company_id: req.user!.id, org_id: orgId, title: job.title, description: job.description,
      type: job.type, location: job.location || null, salary_range: job.salary_range || null,
      requirements: job.requirements || null, is_active: job.is_active !== undefined ? job.is_active : true,
    });
  }

  if (validJobs.length > 0) {
    const { data: inserted, error } = await adminClient.from('jobs').insert(validJobs).select();
    if (error) throw new AppError(500, error.message);
    for (const j of inserted || []) results.push({ success: true, job: j });
  }

  res.status(201).json({ results, total: jobs.length, succeeded: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length });
});

// PATCH /hiring/pipeline/:applicationId
b2bRouter.patch('/hiring/pipeline/:applicationId', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  requireRole(userOrg.role, ORG_MANAGER_ROLES);

  const { status } = req.body;
  if (!status || !APPLICATION_STATUSES.includes(status as any)) throw new AppError(400, `Invalid status`);

  const { data: app } = await adminClient.from('applications').select('id, job_id, jobs!inner(org_id)').eq('id', req.params.applicationId).eq('jobs.org_id', userOrg.org.id).single();
  if (!app) throw new AppError(404, 'Application not found');

  const { data, error } = await adminClient.from('applications').update({ status }).eq('id', req.params.applicationId).select().single();
  if (error) throw new AppError(500, error.message);
  await logAudit(req.user!.id, 'pipeline_update', 'applications', req.params.applicationId as string, { status });
  res.json({ data });
});

// GET /hiring/applications
b2bRouter.get('/hiring/applications', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');

  const { data, error } = await adminClient
    .from('applications')
    .select('id, job_id, student_id, status, cover_letter, resume_url, created_at, jobs!inner(id, title, type, location), profiles:student_id(id, full_name, avatar_url, headline, skills, location)')
    .eq('jobs.org_id', userOrg.org.id)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// POST /hiring/pipeline/bulk
b2bRouter.post('/hiring/pipeline/bulk', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  requireRole(userOrg.role, ORG_MANAGER_ROLES);

  const { application_ids, status } = req.body;
  if (!application_ids || !Array.isArray(application_ids) || application_ids.length === 0 || !status) throw new AppError(400, 'application_ids and status required');
  if (!APPLICATION_STATUSES.includes(status as any)) throw new AppError(400, 'Invalid status');

  const { data, error } = await adminClient.from('applications').update({ status }).in('id', application_ids).select();
  if (error) throw new AppError(500, error.message);
  res.json({ data, count: data?.length || 0 });
});

// ════════════════════════════════════════
// CONTRACTS
// ════════════════════════════════════════

// GET /contracts
b2bRouter.get('/contracts', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  const { data, error } = await adminClient.from('contracts').select('*, talent:talent_id(id, full_name, avatar_url, headline), milestones:contract_milestones(count)').eq('org_id', userOrg.org.id).order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// POST /contracts
b2bRouter.post('/contracts', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  requireRole(userOrg.role, ORG_MANAGER_ROLES);

  const { talent_id, title, contract_type, description, total_value, currency, terms, starts_at, ends_at } = req.body;
  if (!talent_id || !title || !contract_type) throw new AppError(400, 'talent_id, title, and contract_type required');
  if (!CONTRACT_TYPES.includes(contract_type as any)) throw new AppError(400, 'Invalid contract_type');

  const { data, error } = await adminClient.from('contracts').insert({
    org_id: userOrg.org.id, talent_id, title, contract_type, description: description || null,
    total_value: total_value ?? 0, currency: currency || 'NGN', terms: terms || {},
    starts_at: starts_at || null, ends_at: ends_at || null, created_by: req.user!.id,
  }).select().single();

  if (error) throw new AppError(500, error.message);
  await logAudit(req.user!.id, 'create_contract', 'contracts', data.id, { title, contract_type });
  res.status(201).json({ data });
});

// GET /contracts/:id
b2bRouter.get('/contracts/:id', async (req: Request, res: Response) => {
  const { data, error } = await adminClient.from('contracts').select('*, talent:talent_id(*), milestones:contract_milestones(*)').eq('id', req.params.id).single();
  if (error || !data) throw new AppError(404, 'Contract not found');
  res.json({ data });
});

// PATCH /contracts/:id
b2bRouter.patch('/contracts/:id', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  requireRole(userOrg.role, ORG_MANAGER_ROLES);

  const body = req.body;
  const allowed = ['title', 'description', 'total_value', 'currency', 'terms', 'starts_at', 'ends_at'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) if (body[key] !== undefined) updates[key] = body[key];

  const { data, error } = await adminClient.from('contracts').update(updates).eq('id', req.params.id).eq('org_id', userOrg.org.id).select().single();
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// POST /contracts/:id/status — transition contract status
b2bRouter.post('/contracts/:id/status', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');

  const { status: newStatus } = req.body;
  const { data: contract } = await adminClient.from('contracts').select('id, status, org_id, talent_id').eq('id', req.params.id).single();
  if (!contract) throw new AppError(404, 'Contract not found');

  const allowedNext = CONTRACT_STATUS_TRANSITIONS[contract.status] || [];
  if (!allowedNext.includes(newStatus)) throw new AppError(400, `Cannot transition from '${contract.status}' to '${newStatus}'`);

  const isOrgMember = userOrg.org && userOrg.org.id === contract.org_id;
  const isTalent = contract.talent_id === req.user!.id;
  const canTransition =
    (newStatus === 'signed' && (isOrgMember || isTalent)) ||
    (newStatus === 'active' && isOrgMember) ||
    (newStatus === 'completed' && (isOrgMember || isTalent)) ||
    (newStatus === 'cancelled' && (isOrgMember || isTalent));

  if (!canTransition) throw new AppError(403, 'Insufficient permissions for this status transition');

  const { data, error } = await adminClient.from('contracts').update({ status: newStatus }).eq('id', req.params.id).select().single();
  if (error) throw new AppError(500, error.message);

  // If completed, auto-update service fee and provider payout status
  if (newStatus === 'completed') {
    await adminClient.from('contracts').update({ completed_at: new Date().toISOString() }).eq('id', req.params.id);
  }

  await logAudit(req.user!.id, 'contract_status_change', 'contracts', req.params.id as string, { new_status: newStatus });
  res.json({ data });
});

// ════════════════════════════════════════
// ORG VERIFICATION
// ════════════════════════════════════════

// POST /verification/upload — upload a verification document
b2bRouter.post('/verification/upload', verificationUpload.single('file'), async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  requireRole(userOrg.role, ORG_ADMIN_ROLES);

  const f = (req as any).file as { originalname: string; buffer: Buffer; mimetype: string } | undefined;
  if (!f) throw new AppError(400, 'No file provided');

  const fileName = `${Date.now()}-${f.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const filePath = `verifications/${userOrg.org.id}/${fileName}`;

  const { error: uploadError } = await adminClient.storage.from('org-documents').upload(filePath, f.buffer, {
    contentType: f.mimetype,
    upsert: true,
  });

  if (uploadError) {
    // Fallback to site-assets bucket if org-documents doesn't exist
    const { error: uploadError2, data } = await adminClient.storage.from('site-assets').upload(filePath, f.buffer, {
      contentType: f.mimetype,
      upsert: true,
    });
    if (uploadError2) throw new AppError(500, uploadError2.message);
    const { data: urlData } = adminClient.storage.from('site-assets').getPublicUrl(filePath);
    return res.json({ data: { url: urlData?.publicUrl || null, path: filePath } });
  }

  const { data: urlData } = adminClient.storage.from('org-documents').getPublicUrl(filePath);
  res.json({ data: { url: urlData?.publicUrl || null, path: filePath } });
});

// POST /billing/upload-proof — upload payment proof document
b2bRouter.post('/billing/upload-proof', verificationUpload.single('file'), async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');

  const f = (req as any).file as { originalname: string; buffer: Buffer; mimetype: string } | undefined;
  if (!f) throw new AppError(400, 'No file provided');

  const fileName = `${Date.now()}-${f.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const filePath = `payments/${userOrg.org.id}/${fileName}`;

  const { error: uploadError } = await adminClient.storage.from('org-documents').upload(filePath, f.buffer, {
    contentType: f.mimetype,
    upsert: true,
  });

  if (uploadError) throw new AppError(500, uploadError.message);

  const { data: urlData } = adminClient.storage.from('org-documents').getPublicUrl(filePath);
  res.json({ data: { url: urlData?.publicUrl || null, path: filePath } });
});

// GET /verification — get current org's verification status
b2bRouter.get('/verification', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');

  const { data, error } = await adminClient
    .from('org_verifications')
    .select('*')
    .eq('org_id', userOrg.org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') {
      return res.json({ data: null });
    }
    throw new AppError(500, error.message);
  }

  res.json({ data: data || null });
});

// POST /verification — submit a verification request
b2bRouter.post('/verification', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  requireRole(userOrg.role, ORG_ADMIN_ROLES);

  const { business_name, registration_number, tax_id, document_urls } = req.body;
  if (!business_name) throw new AppError(400, 'Business name is required');

  // Check for existing pending verification
  const { data: existing } = await adminClient
    .from('org_verifications')
    .select('id, status')
    .eq('org_id', userOrg.org.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) throw new AppError(409, 'A pending verification request already exists');

  const { data, error } = await adminClient
    .from('org_verifications')
    .insert({
      org_id: userOrg.org.id,
      business_name,
      registration_number: registration_number || null,
      tax_id: tax_id || null,
      document_urls: document_urls || [],
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new AppError(500, error.message);
  res.status(201).json({ data });
});

// ════════════════════════════════════════
// BILLING — PLANS, INVOICES, HISTORY
// ════════════════════════════════════════

// GET /billing/plans — list active subscription plans
b2bRouter.get('/billing/plans', async (_req: Request, res: Response) => {
  const { data, error } = await adminClient
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// GET /billing/invoices — current org's invoices
b2bRouter.get('/billing/invoices', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');

  const status = req.query.status as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    let query = adminClient
      .from('billing_invoices')
      .select('*', { count: 'exact' })
      .eq('org_id', userOrg.org.id);

    if (status) query = query.eq('status', status);

    const { data: invoices, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (error.code === '42P01') {
        return res.json({ data: [], count: 0, limit, offset });
      }
      throw new AppError(500, error.message);
    }

    const planIds = [...new Set((invoices || []).map((inv: any) => inv.plan_id).filter(Boolean))];
    const planResult = planIds.length > 0
      ? await adminClient.from('subscription_plans').select('id, name, slug').in('id', planIds)
      : { data: [] };
    const planMap = new Map((planResult.data || []).map((p: any) => [p.id, { name: p.name, slug: p.slug }]));

    const data = (invoices || []).map((inv: any) => ({
      ...inv,
      plan: planMap.get(inv.plan_id) || null,
    }));

    res.json({ data, count, limit, offset });
  } catch (err) {
    if (err instanceof AppError) throw err;
    res.json({ data: [], count: 0, limit, offset });
  }
});

// GET /billing/history — current org's billing history
b2bRouter.get('/billing/history', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    let query = adminClient
      .from('billing_history')
      .select('*', { count: 'exact' })
      .eq('org_id', userOrg.org.id);

    const { data: history, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (error.code === '42P01') {
        return res.json({ data: [], count: 0, limit, offset });
      }
      throw new AppError(500, error.message);
    }

    const planIds = [...new Set([...(history || []).map((h: any) => h.from_plan_id), ...(history || []).map((h: any) => h.to_plan_id)].filter(Boolean))];
    const userIds = [...new Set((history || []).map((h: any) => h.changed_by).filter(Boolean))];

    const [planResult, userResult] = await Promise.all([
      planIds.length > 0
        ? adminClient.from('subscription_plans').select('id, name, slug').in('id', planIds)
        : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? adminClient.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
        : Promise.resolve({ data: [] }),
    ]);

    const planMap = new Map((planResult.data || []).map((p: any) => [p.id, { name: p.name, slug: p.slug }]));
    const userMap = new Map((userResult.data || []).map((u: any) => [u.id, { full_name: u.full_name, avatar_url: u.avatar_url }]));

    const data = (history || []).map((h: any) => ({
      ...h,
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
// BILLING — PAYMENTS
// ════════════════════════════════════════

// POST /billing/manual-payment — submit an offline payment
b2bRouter.post('/billing/manual-payment', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');

  const { plan_id, amount, proof_url } = req.body;
  if (!plan_id || !amount) throw new AppError(400, 'plan_id and amount required');

  const { data, error } = await adminClient
    .from('billing_payments')
    .insert({
      org_id: userOrg.org.id,
      plan_id,
      amount,
      currency: 'NGN',
      payment_method: 'offline',
      status: 'pending',
      proof_url: proof_url || null,
    })
    .select()
    .single();
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// GET /billing/payments — current org's payment history
b2bRouter.get('/billing/payments', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');

  const { data, error } = await adminClient
    .from('billing_payments')
    .select('*, plan:plan_id(id, name, slug)')
    .eq('org_id', userOrg.org.id)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ════════════════════════════════════════
// ANALYTICS — ORG OVERVIEW
// ════════════════════════════════════════

// GET /analytics/overview — org-level analytics
b2bRouter.get('/analytics/overview', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  const orgId = userOrg.org.id;

  try {
    const [
      contractsResult,
      pipelineResult,
      jobsResult,
      membersResult,
      talentListsResult,
      savedSearchesResult,
      savedTalentResult,
    ] = await Promise.all([
      adminClient.from('contracts').select('status, total_value, created_at').eq('org_id', orgId),
      adminClient.from('job_applications').select('status, jobs!inner(org_id)').eq('jobs.org_id', orgId),
      adminClient.from('jobs').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_active', true),
      adminClient.from('org_members').select('role', { count: 'exact' }).eq('org_id', orgId),
      adminClient.from('talent_lists').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      adminClient.from('saved_searches').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      adminClient.from('saved_talent').select('id, list_id', { count: 'exact' })
        .in('list_id', adminClient.from('talent_lists').select('id').eq('org_id', orgId) as any),
    ]);

    const contracts = contractsResult.data || [];
    const totalContracts = contracts.length;
    const totalValue = contracts.reduce((sum: number, c: any) => sum + (c.total_value || 0), 0);
    const byStatus: Record<string, number> = {};
    const monthlyValue: Record<string, number> = {};
    for (const c of contracts) {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      if (c.created_at) {
        const month = c.created_at.substring(0, 7);
        monthlyValue[month] = (monthlyValue[month] || 0) + (c.total_value || 0);
      }
    }

    const pipelineData = pipelineResult.data || [];
    const pipelineByStatus: Record<string, number> = {};
    for (const a of pipelineData) {
      pipelineByStatus[a.status] = (pipelineByStatus[a.status] || 0) + 1;
    }

    const membersData = membersResult.data || [];
    const teamByRole: Record<string, number> = {};
    for (const m of membersData) {
      teamByRole[m.role] = (teamByRole[m.role] || 0) + 1;
    }

    const analytics = {
      contracts: {
        total: totalContracts,
        total_value: totalValue,
        by_status: byStatus,
        monthly_value: monthlyValue,
      },
      pipeline: {
        total: pipelineData.length,
        by_status: pipelineByStatus,
      },
      jobs: { active: jobsResult.count || 0 },
      team: { total: membersData.length, by_role: teamByRole },
      talent: {
        saved: savedTalentResult.data?.length || 0,
        lists: talentListsResult.count || 0,
        saved_searches: savedSearchesResult.count || 0,
      },
    };

    res.json(analytics);
  } catch (err) {
    if (err instanceof AppError) throw err;
    res.json({
      contracts: { total: 0, total_value: 0, by_status: {}, monthly_value: {} },
      pipeline: { total: 0, by_status: {} },
      jobs: { active: 0 },
      team: { total: 0, by_role: {} },
      talent: { saved: 0, lists: 0, saved_searches: 0 },
    });
  }
});

// ════════════════════════════════════════
// MEETINGS
// ════════════════════════════════════════

// GET /meetings — list org meetings
b2bRouter.get('/meetings', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');

  const status = req.query.status as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const offset = parseInt(req.query.offset as string) || 0;

  let query = adminClient
    .from('org_meetings')
    .select('*, participants:org_meeting_participants(*)')
    .eq('org_id', userOrg.org.id);

  if (status) {
    const statuses = status.split(',');
    query = query.in('status', statuses);
  }

  const { data, error, count } = await query
    .order('scheduled_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    if (error.code === '42P01') return res.json({ data: [], count: 0 });
    throw new AppError(500, error.message);
  }

  res.json({ data: data || [], count, limit, offset });
});

// GET /meetings/upcoming — get upcoming meetings (scheduled or live)
b2bRouter.get('/meetings/upcoming', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');

  const { data, error } = await adminClient
    .from('org_meetings')
    .select('*, participants:org_meeting_participants(*)')
    .eq('org_id', userOrg.org.id)
    .in('status', ['scheduled', 'live'])
    .gte('scheduled_at', new Date(Date.now() - 86400000).toISOString())
    .order('scheduled_at', { ascending: true });

  if (error) {
    if (error.code === '42P01') return res.json({ data: [] });
    throw new AppError(500, error.message);
  }

  res.json({ data: data || [] });
});

// POST /meetings — schedule a new meeting
b2bRouter.post('/meetings', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  requireRole(userOrg.role, ORG_MANAGER_ROLES);

  const { title, description, scheduled_at, duration_minutes, participant_ids } = req.body;
  if (!title || !scheduled_at) throw new AppError(400, 'Title and scheduled time are required');

  const roomName = `b2b-${userOrg.org.slug}-${Date.now().toString(36)}`;
  const meetingUrl = `https://meet.jit.si/${encodeURIComponent(roomName)}`;

  const { data: meeting, error } = await adminClient
    .from('org_meetings')
    .insert({
      org_id: userOrg.org.id,
      title,
      description: description || null,
      meeting_url: meetingUrl,
      room_name: roomName,
      scheduled_at,
      duration_minutes: duration_minutes || 60,
      status: 'scheduled',
      created_by: req.user!.id,
    })
    .select()
    .single();

  if (error) throw new AppError(500, error.message);

  if (participant_ids && Array.isArray(participant_ids) && participant_ids.length > 0) {
    const participantRows = participant_ids.map((userId: string, i: number) => ({
      meeting_id: meeting.id,
      user_id: userId,
      participant_type: 'member',
      role: i === 0 ? 'host' : 'participant',
    }));

    const { error: partErr } = await adminClient
      .from('org_meeting_participants')
      .insert(participantRows);

    if (partErr) console.error('Failed to add participants:', partErr);
  }

  await logAudit(req.user!.id, 'schedule_meeting', 'org_meetings', meeting.id, { title, scheduled_at });
  res.status(201).json({ data: meeting });
});

// PATCH /meetings/:id — update a meeting
b2bRouter.patch('/meetings/:id', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  requireRole(userOrg.role, ORG_MANAGER_ROLES);

  const allowed = ['title', 'description', 'scheduled_at', 'duration_minutes', 'status'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const { data, error } = await adminClient
    .from('org_meetings')
    .update(updates)
    .eq('id', req.params.id)
    .eq('org_id', userOrg.org.id)
    .select()
    .single();

  if (error) throw new AppError(500, error.message);
  await logAudit(req.user!.id, 'update_meeting', 'org_meetings', data.id, updates);
  res.json({ data });
});

// POST /meetings/:id/start — start a meeting (set to live)
b2bRouter.post('/meetings/:id/start', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');

  const { data, error } = await adminClient
    .from('org_meetings')
    .update({ status: 'live' })
    .eq('id', req.params.id)
    .eq('org_id', userOrg.org.id)
    .in('status', ['scheduled'])
    .select()
    .single();

  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(400, 'Meeting cannot be started (not found or already started)');

  res.json({ data });
});

// POST /meetings/:id/end — end a meeting
b2bRouter.post('/meetings/:id/end', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');

  const { data, error } = await adminClient
    .from('org_meetings')
    .update({ status: 'completed' })
    .eq('id', req.params.id)
    .eq('org_id', userOrg.org.id)
    .eq('status', 'live')
    .select()
    .single();

  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// POST /meetings/:id/cancel — cancel a meeting
b2bRouter.post('/meetings/:id/cancel', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  requireRole(userOrg.role, ORG_MANAGER_ROLES);

  const { data, error } = await adminClient
    .from('org_meetings')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id)
    .eq('org_id', userOrg.org.id)
    .select()
    .single();

  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// POST /meetings/:id/notify — send notification to all participants
b2bRouter.post('/meetings/:id/notify', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');

  const { data: meeting } = await adminClient
    .from('org_meetings')
    .select('*, participants:org_meeting_participants(*)')
    .eq('id', req.params.id)
    .eq('org_id', userOrg.org.id)
    .single();

  if (!meeting) throw new AppError(404, 'Meeting not found');

  const participantUserIds = (meeting.participants || [])
    .filter((p: any) => p.user_id)
    .map((p: any) => p.user_id);

  if (participantUserIds.length > 0) {
    const message = req.body.message || `Reminder: Meeting "${meeting.title}" at ${new Date(meeting.scheduled_at).toLocaleString()}`;
    const notifications = participantUserIds.map((userId: string) => ({
      meeting_id: meeting.id,
      org_id: userOrg.org.id,
      recipient_id: userId,
      type: 'reminder',
      message,
    }));

    const { error: notifErr } = await adminClient
      .from('org_meeting_notifications')
      .insert(notifications);

    if (notifErr) throw new AppError(500, notifErr.message);
  }

  res.json({ success: true, notified_count: participantUserIds.length });
});

// GET /meetings/:id — get single meeting detail
b2bRouter.get('/meetings/:id', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');

  const { data, error } = await adminClient
    .from('org_meetings')
    .select('*, participants:org_meeting_participants(*)')
    .eq('id', req.params.id)
    .eq('org_id', userOrg.org.id)
    .single();

  if (error) throw new AppError(404, 'Meeting not found');
  res.json({ data });
});

// GET /meetings/notifications — get notifications for current user
b2bRouter.get('/meetings/notifications', async (req: Request, res: Response) => {
  const { data, error } = await adminClient
    .from('org_meeting_notifications')
    .select('*, meeting:meeting_id(*)')
    .eq('recipient_id', req.user!.id)
    .order('sent_at', { ascending: false })
    .limit(50);

  if (error) {
    if (error.code === '42P01') return res.json({ data: [] });
    throw new AppError(500, error.message);
  }

  res.json({ data: data || [] });
});

// POST /meetings/notifications/:id/read — mark notification as read
b2bRouter.post('/meetings/notifications/:id/read', async (req: Request, res: Response) => {
  const { error } = await adminClient
    .from('org_meeting_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('recipient_id', req.user!.id);

  if (error) throw new AppError(500, error.message);
  res.json({ success: true });
});

// ════════════════════════════════════════
// COMPLIANCE — REPORTS
// ════════════════════════════════════════

// GET /compliance/reports — current org's compliance reports
b2bRouter.get('/compliance/reports', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    const { data: reports, error, count } = await adminClient
      .from('compliance_reports')
      .select('*', { count: 'exact' })
      .eq('org_id', userOrg.org.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (error.code === '42P01') {
        return res.json({ data: [], count: 0, limit, offset });
      }
      throw new AppError(500, error.message);
    }

    res.json({ data: reports || [], count, limit, offset });
  } catch (err) {
    if (err instanceof AppError) throw err;
    res.json({ data: [], count: 0, limit, offset });
  }
});

// POST /compliance/reports — generate a compliance report
b2bRouter.post('/compliance/reports', async (req: Request, res: Response) => {
  const userOrg = await getUserOrg(req.user!.id);
  if (!userOrg) throw new AppError(404, 'No organization found');
  requireRole(userOrg.role, ORG_ADMIN_ROLES);

  const { report_type } = req.body;
  if (!report_type) throw new AppError(400, 'Report type is required');

  try {
    const { data, error } = await adminClient
      .from('compliance_reports')
      .insert({
        org_id: userOrg.org.id,
        report_type,
        title: `${report_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} Report`,
        data: {},
      })
      .select()
      .single();

    if (error) {
      if (error.code === '42P01') {
        throw new AppError(404, 'Compliance reports table not available yet');
      }
      throw new AppError(500, error.message);
    }

    res.status(201).json({ data });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(500, 'Failed to generate compliance report');
  }
});
