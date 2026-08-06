import { Router, Request, Response } from 'express';
import { adminClient } from '../../lib/supabase-admin.js';
import { AppError } from '../../middleware/error.js';
import pino from 'pino';

export const githubRouter: Router = Router();

const logger = pino({ name: 'github-oauth' });

const ENCRYPTION_KEY = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || 'default-dev-key-change-in-production';

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  name: string | null;
}

// ── Helpers ──

/** Read GitHub OAuth credentials from site_settings (admin-configurable) with env fallback. */
async function getGitHubOAuthConfig(): Promise<{ clientId: string; clientSecret: string }> {
  const { data } = await adminClient
    .from('site_settings')
    .select('key, value')
    .in('key', ['github_oauth_client_id', 'github_oauth_client_secret']);

  const settings: Record<string, string> = {};
  if (data) {
    for (const row of data) {
      settings[row.key] = row.value as string;
    }
  }

  return {
    clientId: settings['github_oauth_client_id'] || process.env.GITHUB_CLIENT_ID || '',
    clientSecret: settings['github_oauth_client_secret'] || process.env.GITHUB_CLIENT_SECRET || '',
  };
}

async function exchangeCode(code: string, clientId: string, clientSecret: string): Promise<TokenResponse> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  return res.json();
}

async function getGitHubUser(token: string): Promise<GitHubUser> {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

function encrypt(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
  }
  return Buffer.from(result, 'binary').toString('base64');
}

function decrypt(encoded: string): string {
  const text = Buffer.from(encoded, 'base64').toString('binary');
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
  }
  return result;
}

// ── Public: GitHub OAuth callback (no auth — GitHub redirects here) ──

async function storeConnection(userId: string, token: string): Promise<void> {
  const ghUser = await getGitHubUser(token);
  const { error } = await adminClient
    .from('github_connections')
    .upsert({
      user_id: userId,
      github_id: ghUser.id,
      github_login: ghUser.login,
      github_avatar_url: ghUser.avatar_url,
      github_url: ghUser.html_url,
      access_token: encrypt(token),
    }, { onConflict: 'user_id' });

  if (error) throw new Error('Failed to store GitHub connection');
}

export async function handleGithubCallback(req: Request, res: Response) {
  const { code, state } = req.query;
  const clientUrl = process.env.CLIENT_URL || 'https://thebridgeapp.vercel.app';

  if (!code || typeof code !== 'string') {
    return res.redirect(`${clientUrl}/academy/playground?error=missing_code`);
  }

  const userId = typeof state === 'string' ? state : null;
  if (!userId) {
    return res.redirect(`${clientUrl}/academy/playground?error=missing_state`);
  }

  try {
    const config = await getGitHubOAuthConfig();
    if (!config.clientId || !config.clientSecret) {
      return res.redirect(`${clientUrl}/academy/playground?error=oauth_not_configured`);
    }

    const tokenResponse = await exchangeCode(code, config.clientId, config.clientSecret);
    if (!tokenResponse.access_token) {
      return res.redirect(`${clientUrl}/academy/playground?error=token_exchange_failed`);
    }

    await storeConnection(userId, tokenResponse.access_token);

    return res.redirect(`${clientUrl}/academy/playground?github=connected`);
  } catch (err) {
    logger.error({ err, code, state }, 'GitHub OAuth callback failed');
    return res.redirect(`${clientUrl}/academy/playground?error=connection_failed`);
  }
}

// ── Authenticated Routes ──

// GET /github/url — return the GitHub OAuth authorization URL
githubRouter.get('/url', async (req: Request, res: Response) => {
  const config = await getGitHubOAuthConfig();
  const redirectUri = process.env.GITHUB_REDIRECT_URI || `https://${req.get('host')}/api/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user&state=${req.user!.id}`;
  res.json({ data: { url } });
});

// POST /github/connect — exchange code for token, store encrypted
githubRouter.post('/connect', async (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code) throw new AppError(400, 'Missing code');

  const config = await getGitHubOAuthConfig();
  const tokenResponse = await exchangeCode(code, config.clientId, config.clientSecret);
  if (!tokenResponse.access_token) {
    throw new AppError(400, 'Failed to exchange code');
  }

  const ghUser = await getGitHubUser(tokenResponse.access_token);

  const { data: connection, error: upsertError } = await adminClient
    .from('github_connections')
    .upsert({
      user_id: req.user!.id,
      github_id: ghUser.id,
      github_login: ghUser.login,
      github_avatar_url: ghUser.avatar_url,
      github_url: ghUser.html_url,
      access_token: encrypt(tokenResponse.access_token),
    }, { onConflict: 'user_id' })
    .select('id, user_id, github_id, github_login, github_avatar_url, github_url, created_at')
    .single();

  if (upsertError) throw new AppError(500, 'Failed to store connection');

  res.status(201).json({ data: connection });
});

// GET /github/token — decrypt and return the token
githubRouter.get('/token', async (req: Request, res: Response) => {
  const { data: conn, error: findError } = await adminClient
    .from('github_connections')
    .select('access_token')
    .eq('user_id', req.user!.id)
    .single();

  if (findError || !conn) {
    return res.json({ data: { token: null } });
  }

  res.json({ data: { token: decrypt(conn.access_token) } });
});

// GET /github/connection — get connection metadata (no token)
githubRouter.get('/connection', async (req: Request, res: Response) => {
  const { data: conn, error: findError } = await adminClient
    .from('github_connections')
    .select('id, user_id, github_id, github_login, github_avatar_url, github_url, created_at')
    .eq('user_id', req.user!.id)
    .maybeSingle();

  if (findError || !conn) {
    return res.json({ data: null });
  }

  res.json({ data: conn });
});

// DELETE /github/connection — remove the connection record
githubRouter.delete('/connection', async (req: Request, res: Response) => {
  await adminClient.from('github_connections').delete().eq('user_id', req.user!.id);
  res.json({ data: { success: true } });
});
