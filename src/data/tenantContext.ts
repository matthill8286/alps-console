import { createContext, useContext } from 'react';

export const TENANTS = ['tenant-alpha', 'tenant-beta'] as const;

export type TenantContextValue = { tenantId: string; switchTenant: (next: string) => void };

export const TenantContext = createContext<TenantContextValue | null>(null);

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used inside <TenantProvider>');
  return ctx;
}
