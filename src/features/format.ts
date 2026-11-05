import type { IMEI } from '../api/operations';

export const NO_VALUE = '—';

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const formatDate = (iso: string | null | undefined) =>
  iso ? dateTime.format(new Date(iso)) : NO_VALUE;

export const primaryImei = (imeis: IMEI[] | null) =>
  imeis?.find((i) => i.isPrimary)?.imei ?? imeis?.[0]?.imei ?? NO_VALUE;

export const pageCount = (total: number | null | undefined, pageSize: number) =>
  Math.max(1, Math.ceil((total ?? 0) / pageSize));

export const compact = <T>(items: (T | null)[] | null | undefined): T[] =>
  (items ?? []).filter((item): item is T => item !== null);
