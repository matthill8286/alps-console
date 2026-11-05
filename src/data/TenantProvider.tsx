import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { dropScope } from './cache';
import { TENANTS, TenantContext } from './tenantContext';

type Props = { initial?: string; children: ReactNode };

export function TenantProvider({ initial = TENANTS[0], children }: Props) {
  const [tenantId, setTenantId] = useState(initial);

  const switchTenant = useCallback(
    (next: string) => {
      if (next === tenantId) return;
      // Evict first, so nothing from the old tenant is readable by the time the new one renders.
      dropScope(tenantId);
      setTenantId(next);
    },
    [tenantId],
  );

  const value = useMemo(() => ({ tenantId, switchTenant }), [tenantId, switchTenant]);
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
