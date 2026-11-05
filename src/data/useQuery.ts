import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as cache from './cache';
import { stableKey } from './stableKey';
import type { Variables } from './transport';

export type UseQueryResult<TData, TVars> = {
  loading: boolean;
  errors: string[];
  data: TData | undefined;
  refetch: (variables?: TVars, replace?: boolean) => Promise<void>;
  reset: (queryKey?: string) => void;
};

export type QueryOptions<TVars> = {
  variables?: TVars;
  fetchFirst?: boolean;
  queryKey?: string;
  // Not in the original contract: show the last data while new variables load. Never across scopes.
  keepPrevious?: boolean;
  // Set by useTenantQuery.
  scope?: string;
};

type Shown = { scope: string | undefined; data: unknown };

function useStableVariables<T>(value: T): T {
  const key = stableKey(value);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => value, [key]);
}

/**
 * Data is read from the cache entry for the current variables, never held in state. A response
 * can only write to the entry for the variables it was sent with, so a slow response for an old
 * search has nowhere visible to land.
 */
export function useQuery<TData, TVars extends Variables = Variables>(
  query: string,
  options: QueryOptions<TVars> = {},
): UseQueryResult<TData, TVars> {
  const { fetchFirst = false, queryKey, keepPrevious = false, scope } = options;
  const propVariables = useStableVariables((options.variables ?? {}) as TVars);

  // Variables passed to refetch() apply until the props variables change.
  const [override, setOverride] = useState<{ base: TVars; variables: TVars } | null>(null);
  const variables = override?.base === propVariables ? override.variables : propVariables;
  const key = cache.cacheKey(query, variables);

  const metaRef = useRef<cache.EntryMeta>({ queryKey, scope });
  useEffect(() => {
    metaRef.current = { queryKey, scope };
  }, [queryKey, scope]);

  const snapshot = useSyncExternalStore(
    useCallback((listener: () => void) => cache.subscribe(key, listener), [key]),
    () => cache.getSnapshot(key),
  );

  useEffect(() => {
    if (fetchFirst) void cache.load(query, variables, metaRef.current);
    // key covers query and variables by value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fetchFirst]);

  const [shown, setShown] = useState<Shown | null>(null);
  if (snapshot.data !== undefined && (shown?.data !== snapshot.data || shown.scope !== scope)) {
    setShown({ scope, data: snapshot.data });
  }

  const usePlaceholder =
    snapshot.data === undefined &&
    keepPrevious &&
    snapshot.status !== 'error' &&
    shown?.scope === scope;
  const data = usePlaceholder ? shown?.data : snapshot.data;

  const refetch = useCallback(
    (next?: TVars, replace = false) => {
      const nextVariables =
        next === undefined ? variables : replace ? next : { ...variables, ...next };
      if (next !== undefined) setOverride({ base: propVariables, variables: nextVariables });
      return cache.load(query, nextVariables, metaRef.current, { force: true });
    },
    [query, variables, propVariables],
  );

  const reset = useCallback(
    (target: string | undefined = queryKey) => {
      setOverride(null);
      setShown(null);
      if (target) cache.cancelQueryKey(target);
      else cache.cancelKey(key);
    },
    [queryKey, key],
  );

  // Before the mount effect fires there's no request yet, but one is about to start.
  const aboutToFetch = fetchFirst && snapshot.status === 'idle' && snapshot.data === undefined;

  return {
    loading: snapshot.status === 'loading' || aboutToFetch,
    errors: snapshot.errors,
    data: data as TData | undefined,
    refetch,
    reset,
  };
}
