import { stableKey } from './stableKey';
import { errorMessage, request, type Variables } from './transport';

// See NOTES.md for why 30s.
export const TTL_MS = 30_000;

export type Status = 'idle' | 'loading' | 'success' | 'error';

export type Snapshot = {
  status: Status;
  data: unknown;
  errors: string[];
};

export type EntryMeta = {
  queryKey?: string;
  scope?: string;
};

export type Entry = EntryMeta & {
  key: string;
  query: string;
  variables: Variables;
  data: unknown;
  errors: string[];
  fetchedAt: number;
  inflight: { id: number; controller: AbortController; promise: Promise<void> } | null;
  entities: Set<string>;
  listeners: Set<() => void>;
  version: number;
  view: { version: number; snapshot: Snapshot } | null;
};

type Patch = (entity: Record<string, unknown>) => Record<string, unknown>;
type Overlay = { scope: string | undefined; entityId: string; patch: Patch };

const EMPTY: Snapshot = { status: 'idle', data: undefined, errors: [] };

const entries = new Map<string, Entry>();
// Listeners for keys that have no entry yet. useSyncExternalStore subscribes before the effect
// that creates the entry runs.
const orphanListeners = new Map<string, Set<() => void>>();
const overlays = new Map<number, Overlay>();
let requestId = 0;
let overlayId = 0;

export const cacheKey = (query: string, variables: Variables) => stableKey({ query, variables });

export function subscribe(key: string, listener: () => void) {
  listenersFor(key).add(listener);
  return () => listenersFor(key).delete(listener);
}

function listenersFor(key: string) {
  const entry = entries.get(key);
  if (entry) return entry.listeners;
  let set = orphanListeners.get(key);
  if (!set) orphanListeners.set(key, (set = new Set()));
  return set;
}

export function getSnapshot(key: string): Snapshot {
  const entry = entries.get(key);
  if (!entry) return EMPTY;
  if (entry.view?.version === entry.version) return entry.view.snapshot;

  const data = withOverlays(entry);
  let status: Status = 'idle';
  if (entry.inflight) status = 'loading';
  else if (data !== undefined) status = 'success';
  else if (entry.errors.length) status = 'error';

  const snapshot = { status, data, errors: entry.errors };
  entry.view = { version: entry.version, snapshot };
  return snapshot;
}

function ensure(query: string, variables: Variables, meta: EntryMeta): Entry {
  const key = cacheKey(query, variables);
  const existing = entries.get(key);
  if (existing) return existing;

  const entry: Entry = {
    ...meta,
    key,
    query,
    variables,
    data: undefined,
    errors: [],
    fetchedAt: 0,
    inflight: null,
    entities: new Set(),
    listeners: orphanListeners.get(key) ?? new Set(),
    version: 0,
    view: null,
  };
  orphanListeners.delete(key);
  entries.set(key, entry);
  return entry;
}

const isFresh = (entry: Entry) => entry.fetchedAt > 0 && Date.now() - entry.fetchedAt < TTL_MS;

/** Shares an in-flight request for the same key, so identical queries in one tick hit the network once. */
export function load(
  query: string,
  variables: Variables,
  meta: EntryMeta = {},
  { force = false } = {},
) {
  const entry = ensure(query, variables, meta);
  if (!force && entry.inflight) return entry.inflight.promise;
  if (!force && isFresh(entry)) return Promise.resolve();
  return start(entry);
}

function start(entry: Entry): Promise<void> {
  entry.inflight?.controller.abort();
  const id = ++requestId;
  const controller = new AbortController();
  const isCurrent = () => entry.inflight?.id === id;

  const promise = request(entry.query, entry.variables, controller.signal).then(
    (res) => {
      if (!isCurrent()) return;
      entry.inflight = null;
      // A response with `data` replaces the entry even if it also has errors: the resolved fields
      // are real. A response without `data` keeps the last good data alongside the errors.
      if (res.data !== undefined) {
        entry.data = res.data;
        entry.entities = collectEntities(res.data, entry.variables);
      }
      entry.errors = res.errors;
      entry.fetchedAt = res.errors.length ? 0 : Date.now();
      notify(entry);
    },
    (err: unknown) => {
      if (!isCurrent()) return;
      entry.inflight = null;
      entry.errors = [errorMessage(err)];
      entry.fetchedAt = 0;
      notify(entry);
    },
  );

  entry.inflight = { id, controller, promise };
  notify(entry);
  return promise;
}

function clear(entry: Entry) {
  entry.inflight?.controller.abort();
  entry.inflight = null;
  entry.data = undefined;
  entry.errors = [];
  entry.fetchedAt = 0;
  entry.entities = new Set();
  notify(entry);
}

export function cancelQueryKey(queryKey: string) {
  for (const entry of entries.values()) if (entry.queryKey === queryKey) clear(entry);
}

export function cancelKey(key: string) {
  const entry = entries.get(key);
  if (entry) clear(entry);
}

/** Aborts and deletes everything belonging to a tenant, including optimistic overlays. */
export function dropScope(scope: string) {
  for (const [key, entry] of entries) {
    if (entry.scope !== scope) continue;
    clear(entry);
    entries.delete(key);
    if (entry.listeners.size) orphanListeners.set(key, entry.listeners);
  }
  for (const [id, overlay] of overlays) if (overlay.scope === scope) overlays.delete(id);
}

function entriesHolding(scope: string | undefined, entityId: string) {
  return [...entries.values()].filter((e) => e.scope === scope && e.entities.has(entityId));
}

/**
 * Applies `patch` to every cached copy of an entity at read time, leaving server data alone.
 * The returned function removes it, which is an exact rollback even if a refetch landed meanwhile.
 */
export function addOverlay(scope: string | undefined, entityId: string, patch: Patch) {
  const id = ++overlayId;
  overlays.set(id, { scope, entityId, patch });
  entriesHolding(scope, entityId).forEach(notify);
  return () => {
    if (overlays.delete(id)) entriesHolding(scope, entityId).forEach(notify);
  };
}

export function patchEntity(scope: string | undefined, entityId: string, patch: Patch) {
  for (const entry of entriesHolding(scope, entityId)) {
    entry.data = mapEntity(entry.data, entityId, patch);
    notify(entry);
  }
}

/**
 * Marks matching entries stale. With `refetchActive`, mounted ones refetch now, replacing any
 * request already in flight since it may predate the change.
 */
export function invalidate(match: (entry: Entry) => boolean, { refetchActive = true } = {}) {
  for (const entry of [...entries.values()].filter(match)) {
    entry.fetchedAt = 0;
    if (refetchActive && entry.listeners.size > 0) void start(entry);
  }
}

function withOverlays(entry: Entry) {
  let data = entry.data;
  for (const overlay of overlays.values()) {
    if (overlay.scope === entry.scope && entry.entities.has(overlay.entityId)) {
      data = mapEntity(data, overlay.entityId, overlay.patch);
    }
  }
  return data;
}

// Copies only the branches that change, so unaffected objects keep their identity.
function mapEntity(value: unknown, id: string, patch: Patch): unknown {
  if (Array.isArray(value)) {
    const next = value.map((v) => mapEntity(v, id, patch));
    return next.some((v, i) => v !== value[i]) ? next : value;
  }
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    let changed = false;
    const copy: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(source)) {
      copy[k] = mapEntity(v, id, patch);
      if (copy[k] !== v) changed = true;
    }
    const obj = changed ? copy : source;
    return obj.id === id ? patch(obj) : obj;
  }
  return value;
}

// Every string `id` in the response, plus `variables.deviceId` because history rows have no id.
function collectEntities(data: unknown, variables: Variables) {
  const ids = new Set<string>();
  if (typeof variables.deviceId === 'string') ids.add(variables.deviceId);
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      const { id } = value as { id?: unknown };
      if (typeof id === 'string') ids.add(id);
      Object.values(value).forEach(walk);
    }
  };
  walk(data);
  return ids;
}

function notify(entry: Entry) {
  entry.version++;
  entry.listeners.forEach((listener) => listener());
}

export function resetCache() {
  for (const entry of entries.values()) entry.inflight?.controller.abort();
  entries.clear();
  orphanListeners.clear();
  overlays.clear();
}
