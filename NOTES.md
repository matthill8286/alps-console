# Notes

## Race condition

Hooks don't keep response data in state. They read the cache entry for their current variables,
and a response can only be written to the entry for the variables it was sent with. So a late
response for `SN-00` lands in the `SN-00` entry, which nothing is reading once the search is
`SN-001`. When two requests share a key (a forced refetch while one is in flight), the older one is
aborted and anything it returns is dropped because its request id no longer matches.

This all happens in `src/data/cache.ts` and `useQuery.ts`, so components never deal with it. Selecting
device A then B works the same way. The test is `src/data/useQuery.race.test.tsx`.

## Tenant scoping

`tenantId` is React state in `TenantProvider`, read through context. `useTenantQuery` and
`useTenantMutation` add it to the variables, last, so a call site can't override it. They also add
it back on `replace: true` calls, which would otherwise drop it. I didn't use module scope or
`sessionStorage`, because then the tenant a component renders with and the tenant its request
sends can drift apart, and nothing re-renders when the value changes.

Having `tenantId` in the cache key means one tenant's entry is never read for another, but that
alone is luck. The old tenant's data and in-flight requests would still be sitting in the module
cache, and anything that looks entries up by `queryKey` or entity id would cross tenants. So:

- every entry is tagged with its tenant, and overlays and invalidation only touch matching entries
- `switchTenant` aborts and deletes the old tenant's entries before the new tenant renders
- the tenant-scoped UI is keyed on `tenantId`, so selection, search and paging reset in the same render
- `keepPrevious` never shows data across tenants

Switching back costs a refetch, which is a fair price.

## TTL: 30 seconds

Changes made by this operator are invalidated directly, so the TTL only covers changes the console
can't see: other operators and device check-ins. 30 seconds keeps paging back and forth and
re-selecting devices free, and means a list is never more than half a minute behind someone else's
lock. Expired entries are still shown straight away and refreshed in the background. Partial or
failed responses are never treated as fresh.

## Optimistic update

The cache has an overlay layer. The lock adds a patch for one device, and every cached entry that
contains that device applies it when read, so the list row and the detail panel change together.
The server data underneath isn't touched, so rolling back is just removing the overlay, and it stays
correct even if a refetch landed in the meantime.

On success the new state is written into the cached data, then the overlay is removed. Detail,
history and available actions for the device are refetched. The list isn't: its row already shows
the confirmed state. Lists filtered by state are marked stale instead, so an `ACTIVE` filter can
show a `LOCKED` row until it next refreshes. I preferred that to rows vanishing mid-click.

Entries record every string `id` in their data, plus `variables.deviceId`, which is how the cache
can find "everything holding `dev-0042`" without normalising. Invalidating properly by entity would
need `__typename` in the queries and entities stored once under `tenant:type:id`, with queries
pointing at them.

Rejected:

- Snapshot and restore. Breaks when a refetch lands during the mutation: the restore puts stale
  data back over fresh.
- Lifting the mutation to a shared parent and passing overrides down. Every new view of a device
  has to be wired up by hand.
- Having the mutation patch each hook's state. Ties it to whichever hooks happen to be mounted.

`throwError: true` keeps failure on its own path (`catch`, then roll back) instead of checking for
`undefined`. It defaults to off because mutations are mostly fired from click handlers, where a
rejected promise nobody awaits is an unhandled rejection the user never sees.

## Partial data and errors

A response with `data` replaces the cached data even if it also has `errors`. A response with no
`data` keeps the last good data and shows the errors. For `SN-0000-POISON` the panel shows
everything that resolved, a warning with both errors and a retry button, and "Unavailable" for IMSI
and policy so they don't look empty. Hiding a working device because one downstream service timed
out would be worse. The contract's `errors` is `string[]`, so I can't tie each error to its field
by `path`; they're listed together.

On refetch the hook clears by default. `keepPrevious` (my addition to the contract) keeps the last
data while new variables load. The list and the history pager use it, so typing doesn't flicker.
The detail panel doesn't, because showing device A under device B is wrong.

## Setup notes

- `npm install msw` now installs v3, which doesn't export `graphql`, so MSW is pinned to v2.
- The Appendix A `handlers.ts` doesn't type-check against MSW 2.4, 2.6, 2.10 or 2.15 (`gqlError`'s
  return type isn't accepted by the GraphQL resolver type). Vite doesn't type-check, so it runs. I
  added `// @ts-nocheck` at the top rather than change the handlers.
- The API ANDs `imei` and `serialNumber`, so an all-digit search goes as `imei` and anything else
  as `serialNumber`.
- There's no query for states, so the filter uses a constant matching the seed. Action IDs come from
  `listAvailableActions`.
- There are two tests. The race test is the one asked for. The rollback test is extra because you
  can't trigger a rollback from the UI: `listAvailableActions` never offers Lock on a locked device,
  so the mock only rejects it when the console's view is out of date.

## Not done yet

- A mutation that finishes after a tenant switch has nowhere to report its result. It needs a
  notification outside the tenant-keyed tree.
- Other operators' changes only show up after the TTL. A subscription on device state would fix it.
- The optimistic patch only covers `state`. The policy updates when the detail refetch lands.
- No eviction: each distinct search adds an entry that lives until the tenant changes.
- Unmounting doesn't abort, because requests are shared. Counting subscribers would let the last
  one out cancel.
- Types are hand-written. GraphQL Code Generator would catch drift from the schema.
- No retry, refetch on focus, Suspense or normalisation, as the brief asked.
