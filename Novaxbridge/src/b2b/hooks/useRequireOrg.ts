// ============================================================
// useRequireOrg — Route guard that redirects if no org or wrong role
// ============================================================

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrg } from './useOrg';
import type { OrgMemberRole } from '../b2b-types';

export function useRequireOrg(allowedRoles?: OrgMemberRole[]) {
  const { org, role, isLoading, error } = useOrg();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    if (error || !org) {
      // No org — redirect to create org page or onboarding
      navigate('/b2b/setup', { replace: true });
      return;
    }

    if (allowedRoles && role && !allowedRoles.includes(role)) {
      // User has an org but wrong role — redirect to dashboard
      navigate('/b2b/dashboard', { replace: true });
      return;
    }
  }, [org, role, isLoading, error, navigate, allowedRoles]);

  return { org, role, isLoading, hasAccess: !error && !!org };
}
