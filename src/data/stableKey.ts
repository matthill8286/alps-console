// JSON.stringify with sorted keys and undefined values dropped, so equal variables give equal keys
// regardless of property order.
export function stableKey(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
    return Object.fromEntries(
      Object.entries(v)
        .filter(([, inner]) => inner !== undefined)
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  });
}
