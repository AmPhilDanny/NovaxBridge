import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api-client';
import { useAuth } from './useAuth';

interface Permissions {
  [key: string]: boolean;
}

export function usePermissions() {
  const { user, profile } = useAuth();
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile?.role) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchPermissions() {
      try {
        const res = await adminApi.roles();
        if (cancelled) return;
        const match = (res.data || []).find(
          (r) => r.name === profile.role && r.scope === 'platform',
        );
        setPermissions((match?.permissions as Permissions) || null);
      } catch {
        if (!cancelled) setPermissions(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPermissions();
    return () => { cancelled = true; };
  }, [user, profile?.role]);

  const hasPermission = (permission: string): boolean => {
    return permissions?.[permission] === true;
  };

  return { permissions, loading, hasPermission };
}
