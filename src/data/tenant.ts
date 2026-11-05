import { useCallback } from 'react';
import { useTenant } from './tenantContext';
import type { Variables } from './transport';
import { useMutation, type MutationOptions, type UseMutationResult } from './useMutation';
import { useQuery, type QueryOptions, type UseQueryResult } from './useQuery';

export { TENANTS, useTenant } from './tenantContext';

type WithoutTenant<T> = Omit<T, 'tenantId'>;

// tenantId is spread last so call sites can't override it, and re-added on replace: true calls,
// which would otherwise drop it.

export function useTenantQuery<TData, TVars extends Variables = Variables>(
  query: string,
  options: Omit<QueryOptions<WithoutTenant<TVars>>, 'scope'> = {},
): UseQueryResult<TData, WithoutTenant<TVars>> {
  const { tenantId } = useTenant();
  const result = useQuery<TData, Variables>(query, {
    ...options,
    variables: { ...options.variables, tenantId },
    scope: tenantId,
  });

  const { refetch: baseRefetch } = result;
  const refetch = useCallback(
    (variables?: WithoutTenant<TVars>, replace?: boolean) =>
      baseRefetch(variables && { ...variables, tenantId }, replace),
    [baseRefetch, tenantId],
  );

  return { ...result, refetch };
}

export function useTenantMutation<TData, TVars extends Variables = Variables>(
  query: string,
  options: MutationOptions<WithoutTenant<TVars>> = {},
): UseMutationResult<TData, WithoutTenant<TVars>> {
  const { tenantId } = useTenant();
  const result = useMutation<TData, Variables>(query, {
    ...options,
    variables: { ...options.variables, tenantId },
  });

  const { mutateData: baseMutate } = result;
  const mutateData = useCallback(
    (variables?: WithoutTenant<TVars>, replace?: boolean) =>
      baseMutate({ ...variables, tenantId }, replace),
    [baseMutate, tenantId],
  );

  return { ...result, mutateData };
}
