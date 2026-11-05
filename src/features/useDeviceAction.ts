import { useState } from 'react';
import {
  ASSIGN_ACTION,
  QK,
  STATE_NAMES,
  type Action,
  type AssignActionData,
  type AssignActionVars,
} from '../api/operations';
import * as cache from '../data/cache';
import { useTenant, useTenantMutation } from '../data/tenant';
import { errorMessage } from '../data/transport';

export function useDeviceAction(deviceId: string) {
  const { tenantId } = useTenant();
  const mutation = useTenantMutation<AssignActionData, AssignActionVars>(ASSIGN_ACTION, {
    throwError: true,
  });
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    setError(null);
    const { stateId } = action;
    const applyState = (entity: Record<string, unknown>) =>
      'state' in entity && stateId != null
        ? { ...entity, state: { id: stateId, name: STATE_NAMES[stateId] ?? `State ${stateId}` } }
        : entity;

    const removeOverlay = cache.addOverlay(tenantId, deviceId, applyState);

    try {
      const result = await mutation.mutateData({ deviceId, actionId: action.id });
      if (result?.assignAction === false) throw new Error('The server did not apply this action.');

      // Write the confirmed state before lifting the overlay, so nothing flickers back.
      cache.patchEntity(tenantId, deviceId, applyState);
      removeOverlay();

      const holdsDevice = (entry: cache.Entry) =>
        entry.scope === tenantId && entry.entities.has(deviceId);
      // Detail, history and actions have changed in ways we can't derive, so refetch them.
      cache.invalidate((entry) => holdsDevice(entry) && entry.queryKey !== QK.deviceList);
      // List rows already show the new state. Filtered lists may no longer match; revalidate later.
      cache.invalidate((entry) => holdsDevice(entry) && entry.queryKey === QK.deviceList, {
        refetchActive: false,
      });
    } catch (e) {
      removeOverlay();
      setError(errorMessage(e));
    }
  }

  return { run, pending: mutation.loading, error };
}
