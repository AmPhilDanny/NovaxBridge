// ============================================================
// useSubscription — Subscription state hook
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import type { SubscriptionStatus, SubscriptionPlan } from '../b2b-types';
import { getSubscription, changeSubscription, type ChangeSubscriptionInput } from '../lib/api';

interface UseSubscriptionReturn {
  subscription: SubscriptionStatus | null;
  plan: SubscriptionPlan | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  changePlan: (input: ChangeSubscriptionInput) => Promise<void>;
  isChanging: boolean;
}

export function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isChanging, setIsChanging] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getSubscription();
      setSubscription(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load subscription';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const changePlan = useCallback(async (input: ChangeSubscriptionInput) => {
    try {
      setIsChanging(true);
      setError(null);
      await changeSubscription(input);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change subscription';
      setError(message);
      throw err;
    } finally {
      setIsChanging(false);
    }
  }, [refresh]);

  return {
    subscription,
    plan: subscription?.plan ?? null,
    isLoading,
    error,
    refresh,
    changePlan,
    isChanging,
  };
}
