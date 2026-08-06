import { adminClient } from './supabase-admin.js';

/**
 * Check if a user has a specific permission flag based on their platform role.
 * Looks up the user's role in the `roles` table and checks the permission.
 */
export async function userHasPermission(userId: string, permission: string): Promise<boolean> {
  try {
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (!profile?.role) return false;

    // Fallback: users with "admin" or "super_admin" profile role automatically
    // get all permissions — this covers the case where the roles table hasn't
    // been seeded with a matching entry yet.
    if (profile.role === 'admin' || profile.role === 'super_admin') return true;

    const { data: role } = await adminClient
      .from('roles')
      .select('permissions')
      .eq('name', profile.role)
      .eq('scope', 'platform')
      .single();

    if (!role?.permissions) return false;
    return role.permissions[permission] === true;
  } catch {
    return false;
  }
}

/**
 * Check if a user has a specific permission flag for an org role.
 */
export async function orgMemberHasPermission(
  userId: string,
  orgId: string,
  permission: string,
): Promise<boolean> {
  try {
    const { data: membership } = await adminClient
      .from('org_members')
      .select('role')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .single();

    if (!membership?.role) return false;

    const { data: role } = await adminClient
      .from('roles')
      .select('permissions')
      .eq('name', membership.role)
      .eq('scope', 'org')
      .single();

    if (!role?.permissions) return false;
    return role.permissions[permission] === true;
  } catch {
    return false;
  }
}
