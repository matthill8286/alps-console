import { act, renderHook, waitFor } from '@testing-library/react';
import { graphql, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import {
  DEVICE_DETAIL,
  LIST_DEVICES,
  QK,
  type Action,
  type DeviceDetailData,
  type ListDevicesData,
} from '../api/operations';
import { useTenantQuery } from '../data/tenant';
import { TenantProvider } from '../data/TenantProvider';
import { server } from '../test/setup';
import { useDeviceAction } from './useDeviceAction';

// Extra to the one required test: the UI can't reach this path by hand (see NOTES.md).

const wrapper = ({ children }: { children: ReactNode }) => (
  <TenantProvider initial="tenant-alpha">{children}</TenantProvider>
);

const DEVICE = {
  id: 'dev-0001',
  serialNumber: 'SN-0001-A',
  IMEIs: [],
  state: { id: 2, name: 'ACTIVE' },
};
const LOCK: Action = {
  id: 'act-lock',
  actionName: 'Lock device',
  policyName: 'Hard Lock',
  stateId: 3,
};

it('rolls back the list row and the detail panel when the server rejects the lock', async () => {
  let rejectLock: (() => void) | undefined;
  server.use(
    graphql.query('ListDevices', () =>
      HttpResponse.json({
        data: { listDevices: { pageInfo: { total_count: 1 }, deviceList: [DEVICE] } },
      }),
    ),
    graphql.query('DeviceDetail', () => HttpResponse.json({ data: { deviceDetail: DEVICE } })),
    graphql.mutation('AssignAction', async () => {
      await new Promise<void>((resolve) => (rejectLock = resolve));
      return HttpResponse.json({
        errors: [{ message: 'Device is already locked (state transition rejected)' }],
      });
    }),
  );

  const { result } = renderHook(
    () => ({
      list: useTenantQuery<ListDevicesData>(LIST_DEVICES, {
        variables: { page: 1, pageSize: 10 },
        fetchFirst: true,
        queryKey: QK.deviceList,
      }),
      detail: useTenantQuery<DeviceDetailData>(DEVICE_DETAIL, {
        variables: { deviceId: DEVICE.id },
        fetchFirst: true,
        queryKey: QK.deviceDetail,
      }),
      action: useDeviceAction(DEVICE.id),
    }),
    { wrapper },
  );

  const rowState = () => result.current.list.data?.listDevices?.deviceList?.[0]?.state?.name;
  const detailState = () => result.current.detail.data?.deviceDetail?.state?.name;

  await waitFor(() => {
    expect(rowState()).toBe('ACTIVE');
    expect(detailState()).toBe('ACTIVE');
  });

  let done!: Promise<void>;
  act(() => {
    done = result.current.action.run(LOCK);
  });

  expect(rowState()).toBe('LOCKED');
  expect(detailState()).toBe('LOCKED');

  await waitFor(() => expect(rejectLock).toBeDefined());
  await act(async () => {
    rejectLock!();
    await done;
  });

  expect(rowState()).toBe('ACTIVE');
  expect(detailState()).toBe('ACTIVE');
  expect(result.current.action.error).toBe('Device is already locked (state transition rejected)');
});
