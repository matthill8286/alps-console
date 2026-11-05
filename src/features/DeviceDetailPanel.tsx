import { useState, type ReactNode } from 'react';
import {
  DEVICE_DETAIL,
  LIST_AVAILABLE_ACTIONS,
  LIST_DEVICE_HISTORY,
  QK,
  type AvailableActionsData,
  type AvailableActionsVars,
  type DeviceDetailData,
  type DeviceDetailVars,
  type DeviceHistoryData,
  type DeviceHistoryVars,
} from '../api/operations';
import { useTenantQuery } from '../data/tenant';
import { compact, formatDate, NO_VALUE, primaryImei } from './format';
import { LoadError } from './LoadError';
import { Pager } from './Pager';
import { useDeviceAction } from './useDeviceAction';

const HISTORY_PAGE_SIZE = 5;

// Rendered with key={deviceId} by the parent, so switching device starts clean.
export function DeviceDetailPanel({ deviceId }: { deviceId: string }) {
  return (
    <section className="panel" aria-labelledby="detail-heading">
      <h2 id="detail-heading">Device</h2>
      <DetailCard deviceId={deviceId} />
      <HistoryList deviceId={deviceId} />
    </section>
  );
}

function DetailCard({ deviceId }: { deviceId: string }) {
  const { data, loading, errors, refetch } = useTenantQuery<DeviceDetailData, DeviceDetailVars>(
    DEVICE_DETAIL,
    { variables: { deviceId }, fetchFirst: true, queryKey: QK.deviceDetail },
  );
  const device = data?.deviceDetail;

  if (!device) {
    if (loading) return <p className="muted">Loading device…</p>;
    if (errors.length)
      return <LoadError what="this device" errors={errors} onRetry={() => refetch()} />;
    return <p className="muted">No details for this device.</p>;
  }

  // Data plus errors is a partial success: show what resolved, flag what didn't.
  const partial = errors.length > 0;
  const orUnavailable = (value: ReactNode) =>
    value ?? (partial ? <em className="unavailable">Unavailable</em> : NO_VALUE);

  return (
    <>
      {partial && (
        <div role="status" className="warning">
          <p>Some details couldn't be loaded:</p>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
          <button type="button" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}
      <h3>
        {device.deviceBrandName} {device.deviceModelMarketingName}
      </h3>
      <dl className="facts" aria-busy={loading}>
        <dt>Serial number</dt>
        <dd>{device.serialNumber}</dd>
        <dt>Primary IMEI</dt>
        <dd className="mono">{primaryImei(device.IMEIs)}</dd>
        <dt>IMSI</dt>
        <dd className="mono">{orUnavailable(device.imsi)}</dd>
        <dt>State</dt>
        <dd>
          <span className="state">{device.state?.name ?? NO_VALUE}</span>
        </dd>
        <dt>Policy</dt>
        <dd>
          {orUnavailable(
            device.policy && (
              <span className="policy" style={{ borderColor: device.policy.color ?? undefined }}>
                {device.policy.name}
              </span>
            ),
          )}
        </dd>
        <dt>{device.lastCheckin?.label ?? 'Last check-in'}</dt>
        <dd>{formatDate(device.lastCheckin?.date)}</dd>
        <dt>First enrolled</dt>
        <dd>{formatDate(device.firstEnrollAt)}</dd>
        <dt>Locale</dt>
        <dd>{orUnavailable(device.locale)}</dd>
      </dl>
      {device.state && <ActionBar deviceId={deviceId} stateId={device.state.id} />}
    </>
  );
}

function ActionBar({ deviceId, stateId }: { deviceId: string; stateId: number }) {
  const { data, loading, errors } = useTenantQuery<AvailableActionsData, AvailableActionsVars>(
    LIST_AVAILABLE_ACTIONS,
    { variables: { stateId: String(stateId) }, fetchFirst: true, queryKey: QK.availableActions },
  );
  const { run, pending, error } = useDeviceAction(deviceId);
  const actions = compact(data?.listAvailableActions);

  return (
    <div className="actions">
      {!data && errors.length > 0 && (
        <p className="error">Couldn't load actions: {errors.join('; ')}</p>
      )}
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={pending || loading}
          onClick={() => run(action)}
        >
          {action.actionName ?? action.id}
        </button>
      ))}
      {pending && <span className="muted">Sending…</span>}
      {error && (
        <p role="alert" className="error">
          Action failed and was undone: {error}
        </p>
      )}
    </div>
  );
}

function HistoryList({ deviceId }: { deviceId: string }) {
  const [page, setPage] = useState(1);
  const { data, loading, errors, refetch } = useTenantQuery<DeviceHistoryData, DeviceHistoryVars>(
    LIST_DEVICE_HISTORY,
    {
      variables: { deviceId, page, pageSize: HISTORY_PAGE_SIZE },
      fetchFirst: true,
      queryKey: QK.deviceHistory,
      keepPrevious: true,
    },
  );
  const rows = compact(data?.listDeviceHistory?.histories);

  function renderBody() {
    if (!data) {
      if (errors.length)
        return <LoadError what="history" errors={errors} onRetry={() => refetch()} />;
      return <p className="muted">Loading history…</p>;
    }
    if (rows.length === 0) return <p className="muted">No history for this device.</p>;
    return (
      <>
        <ol className="history-list" aria-busy={loading}>
          {rows.map((entry, i) => (
            <li key={`${entry.createdAt}-${i}`}>
              <strong>{entry.actionName ?? entry.type}</strong>
              <span>
                {entry.policyName} → {entry.nextPolicyName}
              </span>
              <span className="muted">
                {formatDate(entry.createdAt)} · {entry.email}
              </span>
            </li>
          ))}
        </ol>
        <Pager
          label="History pages"
          page={page}
          pageSize={HISTORY_PAGE_SIZE}
          total={data.listDeviceHistory?.pageInfo?.total_count}
          onChange={setPage}
        />
      </>
    );
  }

  return (
    <div className="history">
      <h3>History</h3>
      {renderBody()}
    </div>
  );
}
