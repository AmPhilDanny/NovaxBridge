// ============================================================
// useOrgMembers — Team members hook
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import type { OrgMember, OrgMemberRole } from '../b2b-types';
import {
  getOrgMembers,
  inviteMember,
  removeMember,
  type InviteMemberInput,
} from '../lib/api';

interface UseOrgMembersReturn {
  members: OrgMember[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  invite: (input: InviteMemberInput) => Promise<void>;
  remove: (memberId: string) => Promise<void>;
  isInviting: boolean;
  isRemoving: boolean;
}

export function useOrgMembers(): UseOrgMembersReturn {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getOrgMembers();
      setMembers(result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load members';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const invite = useCallback(async (input: InviteMemberInput) => {
    try {
      setIsInviting(true);
      setError(null);
      await inviteMember(input);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to invite member';
      setError(message);
      throw err;
    } finally {
      setIsInviting(false);
    }
  }, [refresh]);

  const remove = useCallback(async (memberId: string) => {
    try {
      setIsRemoving(true);
      setError(null);
      await removeMember(memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove member';
      setError(message);
      throw err;
    } finally {
      setIsRemoving(false);
    }
  }, []);

  return { members, isLoading, error, refresh, invite, remove, isInviting, isRemoving };
}
