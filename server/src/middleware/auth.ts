import { Request, Response, NextFunction } from 'express';
import { adminClient } from '../lib/supabase-admin.js';
import { createClient, User, SupabaseClient } from '@supabase/supabase-js';
import { userHasPermission } from '../lib/permissions.js';

// Extend Express Request with user context
declare global {
  namespace Express {
    interface Request {
      user?: User & { role?: string };
      /** Authenticated Supabase client for this request's user */
      supabaseClient?: SupabaseClient<any, 'public', any>;
    }
  }
}

/**
 * Shared logic to verify a Bearer token and attach user + Supabase client to the request.
 * Returns true on success, false on auth failure.
 */
async function attachUserFromToken(req: Request): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);
  if (!token) return false;

  try {
    const { data: { user }, error } = await adminClient.auth.getUser(token);
    if (error || !user) return false;

    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
    const supabaseUrl = process.env.SUPABASE_URL!;
    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    req.user = { ...user, role: profile?.role || 'student' };
    req.supabaseClient = authedClient;
    return true;
  } catch {
    return false;
  }
}

/**
 * JWT verification middleware.
 * Extracts Bearer token from Authorization header and verifies with Supabase.
 * Attaches `req.user` (verified user info) and `req.supabaseClient` on success.
 * Blocks the request (401) if no valid token is present.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const ok = await attachUserFromToken(req);
  if (!ok) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  next();
}

/**
 * Optional JWT verification middleware.
 * Same as requireAuth but does NOT block unauthenticated requests.
 * If a valid token is present, `req.user` and `req.supabaseClient` are set.
 * If not, the request proceeds without them — route handlers must handle this gracefully.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  await attachUserFromToken(req);
  next();
}

/**
 * Middleware that requires the user to have a specific platform permission.
 * Must be used after `requireAuth`.
 * Falls back to role-based check if roles table lookup fails.
 */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const hasPerm = await userHasPermission(req.user.id, permission);
      if (hasPerm) return next();
      return res.status(403).json({ error: `Missing required permission: ${permission}` });
    } catch {
      return res.status(403).json({ error: 'Unable to verify permissions' });
    }
  };
}

/**
 * Middleware that requires the user to have `access_admin` permission.
 * Must be used after `requireAuth`.
 */
export const requireAdmin = requirePermission('access_admin');
