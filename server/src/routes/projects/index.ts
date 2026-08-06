import { Router, Request, Response } from 'express';
import { adminClient } from '../../lib/supabase-admin.js';
import { AppError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';

export const projectsRouter: Router = Router();

function getDb(req: Request) {
  return req.supabaseClient || adminClient;
}

function requireUser(req: Request, res: Response): boolean {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }
  return true;
}

// ════════════════════════════════════════
// PROJECTS
// ════════════════════════════════════════

// GET / — list all projects (public)
projectsRouter.get('/', async (req: Request, res: Response) => {
  const supabase = getDb(req);

  const { data, error } = await supabase
    .from('projects')
    .select('*, profiles:owner_id(id, full_name, avatar_url), project_roles(id, role_title, is_filled)')
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, error.message);
  res.json({ data: data || [] });
});

// GET /:id — single project detail (public)
projectsRouter.get('/:id', async (req: Request, res: Response) => {
  const supabase = getDb(req);

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*, profiles:owner_id(id, full_name, avatar_url)')
    .eq('id', req.params.id)
    .single();
  if (projectError) throw new AppError(404, 'Project not found');

  const { data: roles } = await supabase
    .from('project_roles')
    .select('*')
    .eq('project_id', req.params.id);
  if (!roles) throw new AppError(500, 'Failed to load project roles');

  const { data: members } = await supabase
    .from('project_members')
    .select('*, profiles:member_id(id, full_name, avatar_url)')
    .eq('project_id', req.params.id);

  let applications = null;
  let myApplications = null;

  if (req.user) {
    // Owner can see all applications
    if (req.user.id === project.owner_id) {
      const { data: apps } = await supabase
        .from('project_applications')
        .select('*, profiles:applicant_id(id, full_name, avatar_url)')
        .eq('project_id', req.params.id);
      applications = apps || [];
    }
    // Current user's own applications
    const { data: mine } = await supabase
      .from('project_applications')
      .select('*')
      .eq('project_id', req.params.id)
      .eq('applicant_id', req.user.id);
    myApplications = mine || [];
  }

  res.json({ data: { ...project, roles, members, applications, myApplications } });
});

// GET /:id/roles — project roles (public, used separately)
projectsRouter.get('/:id/roles', async (req: Request, res: Response) => {
  const supabase = getDb(req);
  const { data, error } = await supabase
    .from('project_roles')
    .select('*')
    .eq('project_id', req.params.id);
  if (error) throw new AppError(500, error.message);
  res.json({ data: data || [] });
});

// POST / — create a new project (auth required)
const createProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  project_type: z.string().optional(),
  roles: z.array(z.object({
    role_title: z.string().min(1),
    description: z.string().optional(),
    is_filled: z.boolean().optional().default(false),
  })).optional(),
});

projectsRouter.post('/',
  validate(createProjectSchema),
  async (req: Request, res: Response) => {
    if (!requireUser(req, res)) return;
    const supabase = getDb(req);
    const { title, description, project_type, roles } = req.body;

    // Create the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        owner_id: req.user!.id,
        title, description,
        project_type: project_type || null,
      })
      .select()
      .single();
    if (projectError) throw new AppError(500, projectError.message);

    // Create roles if provided
    if (roles && roles.length > 0) {
      const { error: rolesError } = await supabase
        .from('project_roles')
        .insert(roles.map((r: any) => ({
          project_id: project.id,
          role_title: r.role_title,
          description: r.description || null,
          is_filled: r.is_filled ?? false,
        })));
      if (rolesError) throw new AppError(500, rolesError.message);
    }

    res.status(201).json({ data: project });
  }
);

// POST /:id/apply — apply for a project role (auth required)
const applySchema = z.object({
  role_id: z.string().uuid(),
  message: z.string().optional(),
});

projectsRouter.post('/:id/apply',
  validate(applySchema),
  async (req: Request, res: Response) => {
    if (!requireUser(req, res)) return;
    const supabase = getDb(req);
    const { role_id, message } = req.body;

    const { data: project } = await supabase.from('projects').select('id').eq('id', req.params.id).maybeSingle();
    if (!project) throw new AppError(404, 'Project not found');

    const { data: existing } = await supabase
      .from('project_applications')
      .select('id')
      .eq('project_id', req.params.id)
      .eq('applicant_id', req.user!.id)
      .eq('role_id', role_id)
      .maybeSingle();
    if (existing) throw new AppError(409, 'You have already applied for this role');

    const { data, error } = await supabase
      .from('project_applications')
      .insert({
        project_id: req.params.id,
        role_id,
        applicant_id: req.user!.id,
        message: message || null,
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw new AppError(500, error.message);
    res.status(201).json({ data });
  }
);

// POST /:id/decide — owner approves/rejects an application (auth required, owner only)
const decideSchema = z.object({
  application_id: z.string().uuid(),
  status: z.enum(['accepted', 'rejected']),
});

projectsRouter.post('/:id/decide',
  validate(decideSchema),
  async (req: Request, res: Response) => {
    if (!requireUser(req, res)) return;
    const supabase = getDb(req);

    // Verify ownership
    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', req.params.id)
      .single();
    if (!project) throw new AppError(404, 'Project not found');
    if (project.owner_id !== req.user!.id) throw new AppError(403, 'Only the project owner can decide on applications');

    const { application_id, status } = req.body;

    // Update the application status
    const { error: appError } = await supabase
      .from('project_applications')
      .update({ status })
      .eq('id', application_id);
    if (appError) throw new AppError(500, appError.message);

    // If accepted, add as member and fill the role
    if (status === 'accepted') {
      const { data: app } = await supabase
        .from('project_applications')
        .select('*, project_roles!inner(role_title)')
        .eq('id', application_id)
        .single();

      if (app) {
        await supabase
          .from('project_members')
          .insert({ project_id: req.params.id, member_id: app.applicant_id, role: (app as any).project_roles?.role_title || null });

        await supabase
          .from('project_roles')
          .update({ is_filled: true })
          .eq('id', app.role_id);
      }
    }

    res.json({ success: true });
  }
);

// ════════════════════════════════════════
// COLLABORATION — Invites, Requests, Chat
// ════════════════════════════════════════

async function requireOwner(req: Request, res: Response): Promise<{ supabase: any; project: any } | null> {
  if (!requireUser(req, res)) return null;
  const supabase = getDb(req);
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, title')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!project) { res.status(404).json({ error: 'Project not found' }); return null; }
  if (project.owner_id !== req.user!.id) { res.status(403).json({ error: 'Only the project owner can perform this action' }); return null; }
  return { supabase, project };
}

async function requireMemberOrOwner(req: Request, res: Response): Promise<{ supabase: any; project: any } | null> {
  if (!requireUser(req, res)) return null;
  const supabase = getDb(req);
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, title')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!project) { res.status(404).json({ error: 'Project not found' }); return null; }
  if (project.owner_id === req.user!.id) return { supabase, project };
  const { data: membership } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', req.params.id)
    .eq('member_id', req.user!.id)
    .maybeSingle();
  if (!membership) { res.status(403).json({ error: 'You are not a member of this project' }); return null; }
  return { supabase, project };
}

// ── GET /:id/collaboration — get collaboration data (members + messages count) ──
projectsRouter.get('/:id/collaboration', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, title, profiles:owner_id(id, full_name, avatar_url)')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!project) throw new AppError(404, 'Project not found');

  const { data: members } = await supabase
    .from('project_members')
    .select('*, profiles:member_id(id, full_name, avatar_url)')
    .eq('project_id', req.params.id);

  const { data: invites } = await supabase
    .from('project_invites')
    .select('*, sender:profiles!sender_id(id, full_name, avatar_url), recipient:profiles!recipient_id(id, full_name, avatar_url)')
    .eq('project_id', req.params.id);

  const { data: requests } = await supabase
    .from('project_join_requests')
    .select('*, requester:profiles!requester_id(id, full_name, avatar_url)')
    .eq('project_id', req.params.id);

  res.json({
    data: {
      ...project,
      members: members || [],
      invites: invites || [],
      joinRequests: requests || [],
    },
  });
});

// ── POST /:id/invite — owner invites a user to join ──
const inviteSchema = z.object({
  recipient_id: z.string().uuid(),
  message: z.string().optional(),
});

projectsRouter.post('/:id/invite',
  validate(inviteSchema),
  async (req: Request, res: Response) => {
    const ctx = await requireOwner(req, res);
    if (!ctx) return;
    const { supabase } = ctx;
    const { recipient_id, message } = req.body;

    const { data: recipient } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', recipient_id)
      .maybeSingle();
    if (!recipient) throw new AppError(404, 'User not found');

    const { data: existingMember } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', req.params.id)
      .eq('member_id', recipient_id)
      .maybeSingle();
    if (existingMember) throw new AppError(409, 'User is already a member of this project');

    const { data: existingInvite } = await supabase
      .from('project_invites')
      .select('id')
      .eq('project_id', req.params.id)
      .eq('recipient_id', recipient_id)
      .eq('status', 'pending')
      .maybeSingle();
    if (existingInvite) throw new AppError(409, 'An invite has already been sent to this user');

    const { data, error } = await supabase
      .from('project_invites')
      .insert({
        project_id: req.params.id,
        sender_id: req.user!.id,
        recipient_id,
        message: message || null,
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw new AppError(500, error.message);

    await supabase.from('notifications').insert({
      profile_id: recipient_id,
      title: 'Project Invitation',
      message: `You've been invited to join "${ctx.project.title}"`,
      type: 'project_invite',
      reference_id: req.params.id,
      reference_type: 'project',
    }).maybeSingle();

    res.status(201).json({ data });
  }
);

// ── GET /:id/invites — list invites for this project (owner sees all, user sees own) ──
projectsRouter.get('/:id/invites', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);

  const { data: project } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!project) throw new AppError(404, 'Project not found');

  let query = supabase
    .from('project_invites')
    .select('*, sender:profiles!sender_id(id, full_name, avatar_url), recipient:profiles!recipient_id(id, full_name, avatar_url)')
    .eq('project_id', req.params.id);

  if (project.owner_id !== req.user!.id) {
    query = query.eq('recipient_id', req.user!.id);
  }

  const { data, error } = await query;
  if (error) throw new AppError(500, error.message);
  res.json({ data: data || [] });
});

// ── POST /:id/invites/:inviteId/respond — accept or decline an invite ──
const respondInviteSchema = z.object({
  status: z.enum(['accepted', 'declined']),
});

projectsRouter.post('/:id/invites/:inviteId/respond',
  validate(respondInviteSchema),
  async (req: Request, res: Response) => {
    if (!requireUser(req, res)) return;
    const supabase = getDb(req);

    const { data: invite } = await supabase
      .from('project_invites')
      .select('*, projects!inner(owner_id)')
      .eq('id', req.params.inviteId)
      .eq('recipient_id', req.user!.id)
      .maybeSingle();
    if (!invite) throw new AppError(404, 'Invite not found or not addressed to you');

    const { status } = req.body;
    const { error: updateError } = await supabase
      .from('project_invites')
      .update({ status })
      .eq('id', req.params.inviteId);
    if (updateError) throw new AppError(500, updateError.message);

    if (status === 'accepted') {
      await supabase
        .from('project_members')
        .insert({ project_id: req.params.id, member_id: req.user!.id, role: null });
    }

    res.json({ success: true });
  }
);

// ── POST /:id/request-join — request to join a project (without specific role) ──
const requestJoinSchema = z.object({
  message: z.string().optional(),
});

projectsRouter.post('/:id/request-join',
  validate(requestJoinSchema),
  async (req: Request, res: Response) => {
    if (!requireUser(req, res)) return;
    const supabase = getDb(req);

    const { data: project } = await supabase
      .from('projects')
      .select('id, owner_id, title')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!project) throw new AppError(404, 'Project not found');

    if (project.owner_id === req.user!.id) throw new AppError(400, 'You are the owner of this project');
    const { data: existingMember } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', req.params.id)
      .eq('member_id', req.user!.id)
      .maybeSingle();
    if (existingMember) throw new AppError(409, 'You are already a member of this project');

    const { data: existingRequest } = await supabase
      .from('project_join_requests')
      .select('id')
      .eq('project_id', req.params.id)
      .eq('requester_id', req.user!.id)
      .eq('status', 'pending')
      .maybeSingle();
    if (existingRequest) throw new AppError(409, 'You already have a pending request to join this project');

    const { message } = req.body;
    const { data, error } = await supabase
      .from('project_join_requests')
      .insert({
        project_id: req.params.id,
        requester_id: req.user!.id,
        message: message || null,
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw new AppError(500, error.message);

    await supabase.from('notifications').insert({
      profile_id: project.owner_id,
      title: 'Join Request',
      message: `Someone wants to join "${project.title}"`,
      type: 'project_join_request',
      reference_id: req.params.id,
      reference_type: 'project',
    }).maybeSingle();

    res.status(201).json({ data });
  }
);

// ── GET /:id/requests — list join requests (owner only) ──
projectsRouter.get('/:id/requests', async (req: Request, res: Response) => {
  const ctx = await requireOwner(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  const { data, error } = await supabase
    .from('project_join_requests')
    .select('*, requester:profiles!requester_id(id, full_name, avatar_url, headline, skills)')
    .eq('project_id', req.params.id);
  if (error) throw new AppError(500, error.message);
  res.json({ data: data || [] });
});

// ── POST /:id/requests/:requestId/decide — owner approves/declines a join request ──
const decideRequestSchema = z.object({
  status: z.enum(['accepted', 'declined']),
});

projectsRouter.post('/:id/requests/:requestId/decide',
  validate(decideRequestSchema),
  async (req: Request, res: Response) => {
    const ctx = await requireOwner(req, res);
    if (!ctx) return;
    const { supabase } = ctx;

    const { data: joinReq } = await supabase
      .from('project_join_requests')
      .select('*')
      .eq('id', req.params.requestId)
      .eq('project_id', req.params.id)
      .maybeSingle();
    if (!joinReq) throw new AppError(404, 'Join request not found');

    const { status } = req.body;
    const { error: updateError } = await supabase
      .from('project_join_requests')
      .update({ status })
      .eq('id', req.params.requestId);
    if (updateError) throw new AppError(500, updateError.message);

    if (status === 'accepted') {
      await supabase
        .from('project_members')
        .insert({ project_id: req.params.id, member_id: joinReq.requester_id, role: null });

      await supabase.from('notifications').insert({
        profile_id: joinReq.requester_id,
        title: 'Join Request Accepted',
        message: `You've been accepted to join "${ctx.project.title}"`,
        type: 'project_join_accepted',
        reference_id: req.params.id,
        reference_type: 'project',
      }).maybeSingle();
    }

    res.json({ success: true });
  }
);

// ════════════════════════════════════════
// COLLABORATION MESSAGES (project-wide chat)
// ════════════════════════════════════════

// GET /:id/messages — list collaboration messages (members & owner)
projectsRouter.get('/:id/messages', async (req: Request, res: Response) => {
  const ctx = await requireMemberOrOwner(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  const { data: messages, error } = await supabase
    .from('project_collaboration_messages')
    .select('*, sender:profiles!sender_id(id, full_name, avatar_url)')
    .eq('project_id', req.params.id)
    .order('created_at', { ascending: true });
  if (error) throw new AppError(500, error.message);

  res.json({ data: messages || [] });
});

// POST /:id/messages — send a collaboration message (members & owner)
const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message is required'),
});

projectsRouter.post('/:id/messages',
  validate(sendMessageSchema),
  async (req: Request, res: Response) => {
    const ctx = await requireMemberOrOwner(req, res);
    if (!ctx) return;
    const { supabase } = ctx;
    const { content } = req.body;

    const { data, error } = await supabase
      .from('project_collaboration_messages')
      .insert({
        project_id: req.params.id,
        sender_id: req.user!.id,
        content: content.trim(),
      })
      .select()
      .single();
    if (error) throw new AppError(500, error.message);

    res.status(201).json({ data });
  }
);
