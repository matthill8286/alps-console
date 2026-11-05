import { act, renderHook, waitFor } from '@testing-library/react';
import { graphql, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { LIST_DEVICES, QK, type ListDevicesData } from '../api/operations';
import { server } from '../test/setup';
import { cacheKey, getSnapshot } from './cache';
import { useTenantQuery } from './tenant';
import { TenantProvider } from './TenantProvider';

const wrapper = ({ children }: { children: ReactNode }) => (
  <TenantProvider initial="tenant-alpha">{children}</TenantProvider>
);

const listOf = (serial: string) => ({
  data: {
    listDevices: {
      pageInfo: { total_count: 1 },
      deviceList: [
        { id: `dev-${serial}`, serialNumber: serial, IMEIs: [], state: { id: 2, name: 'ACTIVE' } },
      ],
    },
  },
});

it('a stale response that arrives last does not overwrite the newer one', async () => {
  // Each request waits to be released, so the test decides the order responses arrive in.
  const release = new Map<string, () => void>();
  server.use(
    graphql.query('ListDevices', async ({ variables }) => {
      const serial = String(variables.serialNumber);
      await new Promise<void>((resolve) => release.set(serial, resolve));
      return HttpResponse.json(listOf(serial));
    }),
  );

  const { result, rerender } = renderHook(
    ({ serialNumber }) =>
      useTenantQuery<ListDevicesData>(LIST_DEVICES, {
        variables: { serialNumber, page: 1, pageSize: 10 },
        fetchFirst: true,
        queryKey: QK.deviceList,
        keepPrevious: true,
      }),
    { wrapper, initialProps: { serialNumber: 'SN-00' } },
  );

  await waitFor(() => expect(release.has('SN-00')).toBe(true));
  rerender({ serialNumber: 'SN-001' });
  await waitFor(() => expect(release.has('SN-001')).toBe(true));

  // Newer request answers first...
  act(() => release.get('SN-001')!());
  await waitFor(() =>
    expect(result.current.data?.listDevices?.deviceList?.[0]?.serialNumber).toBe('SN-001'),
  );

  // ...then the stale one. Wait until the cache has processed it, so it really arrived last.
  act(() => release.get('SN-00')!());
  const staleKey = cacheKey(LIST_DEVICES, {
    serialNumber: 'SN-00',
    page: 1,
    pageSize: 10,
    tenantId: 'tenant-alpha',
  });
  await waitFor(() => expect(getSnapshot(staleKey).status).toBe('success'));

  expect(result.current.data?.listDevices?.deviceList?.[0]?.serialNumber).toBe('SN-001');
  expect(result.current.loading).toBe(false);
  expect(result.current.errors).toEqual([]);
});
