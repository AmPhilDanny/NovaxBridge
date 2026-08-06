import { Router, Request, Response } from 'express';
import { adminClient } from '../../lib/supabase-admin.js';
import { AppError } from '../../middleware/error.js';
import { requireAuth } from '../../middleware/auth.js';

export const academyRouter: Router = Router();

// ALL routes require auth + admin check
academyRouter.use(requireAuth);

// ── Helper: check admin role ──
async function requireAdmin(req: Request): Promise<void> {
  const userId = (req as any).user?.id || (req as any).user?.sub;
  if (!userId) throw new AppError(401, 'Not authenticated');

  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    throw new AppError(403, 'Admin access required');
  }
}

// ── GET /academy/applications — list all tutor applications (admin) ──
academyRouter.get('/applications', async (req: Request, res: Response) => {
  await requireAdmin(req);

  const { status } = req.query;
  let query = adminClient
    .from('tutor_applications')
    .select('*, profile:profiles!user_id(id, full_name, email, avatar_url, role)')
    .order('created_at', { ascending: false });

  if (status && typeof status === 'string') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ── POST /academy/applications/:id/approve — approve a tutor application ──
academyRouter.post('/applications/:id/approve', async (req: Request, res: Response) => {
  await requireAdmin(req);

  const { id } = req.params;
  const adminId = (req as any).user?.id || (req as any).user?.sub;

  // Get the application
  const { data: app, error: fetchError } = await adminClient
    .from('tutor_applications')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !app) throw new AppError(404, 'Application not found');
  if (app.status !== 'pending') throw new AppError(400, `Application is already ${app.status}`);

  // Update application status
  const { error: updateError } = await adminClient
    .from('tutor_applications')
    .update({
      status: 'approved',
      reviewed_by: adminId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) throw new AppError(500, updateError.message);

  // Update user's profile role to 'tutor' (keep existing role as fallback)
  const { error: roleError } = await adminClient
    .from('profiles')
    .update({ role: 'tutor' })
    .eq('id', app.user_id);

  if (roleError) throw new AppError(500, roleError.message);

  // Create a notification for the user
  await adminClient.from('notifications').insert({
    profile_id: app.user_id,
    title: 'Tutor Application Approved',
    message: 'Congratulations! Your tutor application has been approved. You can now create courses.',
    type: 'application_approved',
  }).maybeSingle();

  res.json({ status: 'ok', message: 'Tutor approved' });
});

// ── POST /academy/applications/:id/reject — reject a tutor application ──
academyRouter.post('/applications/:id/reject', async (req: Request, res: Response) => {
  await requireAdmin(req);

  const { id } = req.params;
  const adminId = (req as any).user?.id || (req as any).user?.sub;
  const { reviewer_notes } = req.body || {};

  // Get the application
  const { data: app, error: fetchError } = await adminClient
    .from('tutor_applications')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !app) throw new AppError(404, 'Application not found');
  if (app.status !== 'pending') throw new AppError(400, `Application is already ${app.status}`);

  // Update application status
  const { error: updateError } = await adminClient
    .from('tutor_applications')
    .update({
      status: 'rejected',
      reviewed_by: adminId,
      reviewer_notes: reviewer_notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) throw new AppError(500, updateError.message);

  // Create a notification for the user
  await adminClient.from('notifications').insert({
    profile_id: app.user_id,
    title: 'Tutor Application Update',
    message: reviewer_notes
      ? `Your tutor application was reviewed. Feedback: ${reviewer_notes}`
      : 'Your tutor application has been reviewed. Please check the platform for details.',
    type: 'application_rejected',
  }).maybeSingle();

  res.json({ status: 'ok', message: 'Tutor application rejected' });
});
