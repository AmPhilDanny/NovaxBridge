import { useState, useEffect, useCallback, useRef } from 'react';

// ── Global dedup cache ──
const cache = new Map<string, { data: unknown; promise: Promise<unknown> | null }>();

interface SWROptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  initialData: T;
  onError?: (err: Error) => void;
  revalidateOnFocus?: boolean;
}

interface SWRResult<T> {
  data: T;
  isValidating: boolean;
  error: Error | null;
  mutate: () => void;
}

export function useSWR<T>({
  key,
  fetcher,
  initialData,
  onError,
  revalidateOnFocus = true,
}: SWROptions<T>): SWRResult<T> {
  const existing = cache.get(key);
  const [data, setData] = useState<T>(() => (existing?.data as T) ?? initialData);
  const [isValidating, setIsValidating] = useState(!existing?.data && !existing?.promise);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const keyRef = useRef(key);
  keyRef.current = key;

  const fetchData = useCallback(async (skipCache = false) => {
    const cached = cache.get(keyRef.current);
    if (!skipCache && cached?.promise) {
      // Another caller is already fetching — wait for it
      try { await cached.promise; } catch { /* ignore */ }
      const updated = cache.get(keyRef.current);
      if (updated?.data && mountedRef.current) {
        setData(updated.data as T);
        setIsValidating(false);
      }
      return;
    }

    const promise = fetcher();
    cache.set(keyRef.current, { data: null, promise });

    setIsValidating(true);
    setError(null);

    try {
      const result = await promise;
      cache.set(keyRef.current, { data: result, promise: null });
      if (mountedRef.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      const normalized = err instanceof Error ? err : new Error(String(err));
      cache.set(keyRef.current, { data: null, promise: null });
      if (mountedRef.current) {
        setError(normalized);
        onError?.(normalized);
      }
    } finally {
      if (mountedRef.current) setIsValidating(false);
    }
  }, [fetcher, onError]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    if (!cache.get(key)?.data) fetchData();
    return () => { mountedRef.current = false; };
  }, [key, fetchData]);

  // Re-fetch on visibility change (tab switch / return)
  useEffect(() => {
    if (!revalidateOnFocus) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchData(true); // skip cache, force fresh
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [revalidateOnFocus, fetchData]);

  const mutate = useCallback(() => fetchData(true), [fetchData]);

  return { data, isValidating, error, mutate };
}
