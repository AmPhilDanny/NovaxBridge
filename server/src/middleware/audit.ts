import { Request, Response, NextFunction } from 'express';
import { adminClient } from '../lib/supabase-admin.js';

/**
 * Audit logging middleware for admin mutations.
 * Logs the action, entity type, entity ID, and details to the audit_log table.
 */
export function auditLog(action: string, entityType: string, getEntityId?: (req: Request) => string | null) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Capture the original json to log after response
    const originalJson = res.json.bind(res);
    
    res.json = function (body: any) {
      // Log the audit entry asynchronously (don't await — don't block response)
      const entityId = getEntityId ? getEntityId(req) : null;
      logAuditEntry({
        adminId: req.user?.id || 'unknown',
        action,
        entityType,
        entityId,
        details: {
          method: req.method,
          path: req.path,
          body: sanitizeBody(req.body),
        },
      }).catch(() => {}); // fire-and-forget

      return originalJson(body);
    };

    next();
  };
}

function sanitizeBody(body: any): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  const sanitized = { ...body };
  // Remove sensitive fields
  for (const key of ['password', 'secret_key', 'api_key', 'token']) {
    if (key in sanitized) sanitized[key] = '***';
  }
  return sanitized;
}

async function logAuditEntry(entry: {
  adminId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
}) {
  try {
    await adminClient.from('audit_log').insert({
      admin_id: entry.adminId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      details: entry.details,
    });
  } catch {
    // Silently fail — audit should never break the main flow
  }
}
