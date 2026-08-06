import { Router, Request, Response } from 'express';
import { adminClient } from '../../lib/supabase-admin.js';
import { AppError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';

export const jobsRouter: Router = Router();

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
// JOBS
// ════════════════════════════════════════

// GET / — list active jobs (public)
jobsRouter.get('/', async (req: Request, res: Response) => {
  const supabase = getDb(req);
  const type = req.query.type as string | undefined;

  let query = supabase
    .from('jobs')
    .select('*, profiles:company_id(full_name, company_name, avatar_url)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (type && type !== 'all') query = query.eq('type', type);

  const { data, error } = await query;
  if (error) throw new AppError(500, error.message);
  res.json({ data: data || [] });
});

// GET /my-applications — current user's job applications (auth required)
jobsRouter.get('/my-applications', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);
  const { data, error } = await supabase
    .from('applications')
    .select('*, jobs!inner(id, title, type, location, salary_range, company_id, profiles:company_id(full_name, company_name))')
    .eq('student_id', req.user!.id)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  res.json({ data: data || [] });
});

// POST / — create a new job (auth required, firm only)
jobsRouter.post('/',
  validate(z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    type: z.enum(['part-time', 'internship']),
    location: z.string().optional(),
    salary_range: z.string().optional(),
    requirements: z.string().optional(),
  })),
  async (req: Request, res: Response) => {
    if (!requireUser(req, res)) return;
    const supabase = getDb(req);
    const { title, description, type, location, salary_range, requirements } = req.body;

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        company_id: req.user!.id,
        title, description, type,
        location: location || null,
        salary_range: salary_range || null,
        requirements: requirements || null,
      })
      .select()
      .single();
    if (error) throw new AppError(500, error.message);
    res.status(201).json({ data });
  }
);

// POST /:id/apply — apply for a job (auth required, student only)
jobsRouter.post('/:id/apply', async (req: Request, res: Response) => {
  if (!requireUser(req, res)) return;
  const supabase = getDb(req);

  const { data: job } = await supabase.from('jobs').select('id').eq('id', req.params.id).maybeSingle();
  if (!job) throw new AppError(404, 'Job not found');

  const { data: existing } = await supabase
    .from('applications')
    .select('id')
    .eq('job_id', req.params.id)
    .eq('student_id', req.user!.id)
    .maybeSingle();
  if (existing) throw new AppError(409, 'You have already applied for this job');

  const { data, error } = await supabase
    .from('applications')
    .insert({ job_id: req.params.id, student_id: req.user!.id, status: 'pending' })
    .select()
    .single();
  if (error) throw new AppError(500, error.message);
  res.status(201).json({ data });
});
