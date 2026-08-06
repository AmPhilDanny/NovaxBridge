// ============================================================
// useOrg — Organization state provider & context
// ============================================================

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import type { Organization, OrgMemberRole, UserOrgInfo } from '../b2b-types';
import { getMyOrg } from '../lib/api';

interface OrgContextType {
  org: Organization | null;
  role: OrgMemberRole | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [org, setOrg] = useState<Organization | null>(null);
  const [role, setRole] = useState<OrgMemberRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const userOrg = await getMyOrg();
      setOrg(userOrg.org);
      setRole(userOrg.role);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load organization';
      setError(message);
      setOrg(null);
      setRole(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <OrgContext.Provider value={{ org, role, isLoading, error, refresh }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgContextType {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return context;
}
