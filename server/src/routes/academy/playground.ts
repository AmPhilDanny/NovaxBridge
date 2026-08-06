import { Router, Request, Response } from 'express';
import { adminClient } from '../../lib/supabase-admin.js';
import { AppError } from '../../middleware/error.js';
import { requireAuth } from '../../middleware/auth.js';

export const academyPlaygroundRouter: Router = Router();

academyPlaygroundRouter.use(requireAuth);

const ENCRYPTION_KEY = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || 'default-dev-key-change-in-production';

function decrypt(encoded: string): string {
  const text = Buffer.from(encoded, 'base64').toString('binary');
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
  }
  return result;
}

function sanitizeRepoName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  const suffix = Math.random().toString(36).substring(2, 8);
  return `dala-${slug || 'workspace'}-${suffix}`;
}

// GET / — list current user's workspaces
academyPlaygroundRouter.get('/', async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const { data, error } = await adminClient
    .from('playground_workspaces')
    .select('*, course:courses(title), lesson:lessons(title)')
    .eq('user_id', userId)
    .order('last_opened_at', { ascending: false, nullsFirst: false });

  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// POST / — create a new workspace with a GitHub repo
academyPlaygroundRouter.post('/', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { name, course_id, lesson_id } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new AppError(400, 'Workspace name is required');
  }

  // Fetch the user's GitHub token
  const { data: conn, error: connError } = await adminClient
    .from('github_connections')
    .select('access_token, github_login')
    .eq('user_id', userId)
    .single();

  if (connError || !conn) {
    throw new AppError(400, 'GitHub account not connected. Please connect GitHub first.');
  }

  const token = decrypt(conn.access_token);
  const repoName = sanitizeRepoName(name);

  // Create a private repo on GitHub
  const createRes = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      name: repoName,
      private: true,
      auto_init: true,
      description: `DalaStuduo Playground workspace: ${name}`,
    }),
  });

  const repoData = await createRes.json();
  if (!createRes.ok) {
    throw new AppError(500, `Failed to create GitHub repo: ${repoData.message || 'Unknown error'}`);
  }

  // If linked to a lesson, update the README with custom content
  if (lesson_id) {
    try {
      const { data: lesson } = await adminClient
        .from('lessons')
        .select(`
          title,
          content_body,
          module:course_modules!inner(
            title,
            course:courses!inner(title)
          )
        `)
        .eq('id', lesson_id)
        .single();

      if (lesson) {
        const courseTitle = (lesson as any).module?.course?.title || 'Course';
        const moduleTitle = (lesson as any).module?.title || '';
        const lessonTitle = lesson.title;
        const contentBody = (lesson as any).content_body || '';

        const readmeContent = `# ${courseTitle} — ${lessonTitle}\n\n${moduleTitle ? `*Part of module: ${moduleTitle}*\n\n` : ''}${contentBody || 'Practice workspace for this lesson.'}\n\n---\n*Created by DalaStuduo Academy Playground*`;

        const putRes = await fetch(
          `https://api.github.com/repos/${conn.github_login}/${repoName}/contents/README.md`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Accept: 'application/vnd.github.v3+json',
            },
            body: JSON.stringify({
              message: `Seed README for ${lessonTitle}`,
              content: Buffer.from(readmeContent, 'utf-8').toString('base64'),
            }),
          },
        );

        if (!putRes.ok) {
          const putErr = await putRes.json().catch(() => ({}));
          console.warn('Failed to seed README:', putErr);
        }
      }
    } catch (seedErr) {
      // Non-critical — workspace still works without custom README
      console.warn('Failed to seed lesson README:', seedErr);
    }
  }

  // Insert workspace record
  const { data: workspace, error: insertError } = await adminClient
    .from('playground_workspaces')
    .insert({
      user_id: userId,
      name: name.trim(),
      github_repo_name: repoName,
      github_repo_url: repoData.html_url,
      course_id: course_id || null,
      lesson_id: lesson_id || null,
    })
    .select()
    .single();

  if (insertError) {
    // Non-critical cleanup — repo already created
    console.error('Failed to insert workspace record:', insertError);
    throw new AppError(500, 'Workspace created on GitHub but failed to save. Please try again.');
  }

  res.status(201).json({ data: { ...workspace, github_login: conn.github_login } });
});

// PATCH /:id/opened — update last_opened_at
academyPlaygroundRouter.patch('/:id/opened', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const { data, error } = await adminClient
    .from('playground_workspaces')
    .update({ last_opened_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new AppError(500, error.message);
  res.json({ data });
});
