import { useEffect, useState } from 'react';
import {
  LIST_DEVICES,
  QK,
  STATE_NAMES,
  type ListDevicesData,
  type ListDevicesVars,
} from '../api/operations';
import { useTenantQuery } from '../data/tenant';
import { compact, formatDate, NO_VALUE, pageCount, primaryImei } from './format';
import { LoadError } from './LoadError';
import { Pager } from './Pager';
import { useDebouncedValue } from './useDebouncedValue';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

// The API ANDs imei and serialNumber, so the text can only go in one of them.
function searchVariables(text: string): Pick<ListDevicesVars, 'imei' | 'serialNumber'> {
  const q = text.trim();
  if (!q) return {};
  return /^\d+$/.test(q) ? { imei: q } : { serialNumber: q };
}

type Props = { selectedId: string | null; onSelect: (id: string) => void };

export function DeviceList({ selectedId, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [stateId, setStateId] = useState<number>();
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  // Changing a filter resets to page 1 without an effect: the page belongs to a set of filters.
  const filters = `${debouncedSearch.trim()}|${stateId ?? ''}`;
  const [paging, setPaging] = useState({ filters, page: 1 });
  const page = paging.filters === filters ? paging.page : 1;
  const setPage = (next: number) => setPaging({ filters, page: next });

  const { data, loading, errors, refetch } = useTenantQuery<ListDevicesData, ListDevicesVars>(
    LIST_DEVICES,
    {
      variables: { ...searchVariables(debouncedSearch), stateId, page, pageSize: PAGE_SIZE },
      fetchFirst: true,
      queryKey: QK.deviceList,
      keepPrevious: true,
    },
  );

  const total = data?.listDevices?.pageInfo?.total_count ?? 0;
  const rows = compact(data?.listDevices?.deviceList);
  const lastPage = pageCount(total, PAGE_SIZE);

  useEffect(() => {
    if (data && page > lastPage) setPage(lastPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, page, lastPage]);

  function renderBody() {
    if (data === undefined) {
      if (errors.length)
        return <LoadError what="devices" errors={errors} onRetry={() => refetch()} />;
      return <p className="muted">Loading devices…</p>;
    }
    if (rows.length === 0) return <p className="muted">No devices match.</p>;
    return (
      <table aria-busy={loading} className={loading ? 'is-refreshing' : undefined}>
        <thead>
          <tr>
            <th scope="col">Serial number</th>
            <th scope="col">Primary IMEI</th>
            <th scope="col">Model</th>
            <th scope="col">State</th>
            <th scope="col">Last check-in</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((device) => (
            <tr key={device.id} aria-selected={device.id === selectedId}>
              <td>
                <button type="button" className="link" onClick={() => onSelect(device.id)}>
                  {device.serialNumber ?? device.id}
                </button>
              </td>
              <td className="mono">{primaryImei(device.IMEIs)}</td>
              <td>{device.modelMarketingName ?? NO_VALUE}</td>
              <td>
                <span className="state">{device.state?.name ?? NO_VALUE}</span>
              </td>
              <td>{formatDate(device.lastCheckin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <section className="panel" aria-labelledby="devices-heading">
      <h2 id="devices-heading">Devices</h2>
      <div className="filters">
        <label>
          Search
          <input
            type="search"
            placeholder="IMEI or serial number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          State
          <select
            value={stateId ?? ''}
            onChange={(e) => setStateId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Any</option>
            {Object.entries(STATE_NAMES).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {renderBody()}

      {data !== undefined && errors.length > 0 && (
        <p role="alert" className="error">
          Couldn't refresh, showing earlier results: {errors.join('; ')}
        </p>
      )}

      {data !== undefined && (
        <footer className="list-footer">
          <span className="muted" aria-live="polite">
            {loading ? 'Updating…' : `${total} device${total === 1 ? '' : 's'}`}
          </span>
          <Pager
            label="Device list pages"
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onChange={setPage}
          />
        </footer>
      )}
    </section>
  );
}
