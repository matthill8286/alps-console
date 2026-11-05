export const ENDPOINT = 'http://localhost:3000/graphql';

export type Variables = Record<string, unknown>;

export type GraphQLResponse<T> = {
  // undefined when the body had no `data` at all, as opposed to a partial result
  data: T | undefined;
  errors: string[];
};

export class GraphQLRequestError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join('; '));
    this.name = 'GraphQLRequestError';
    this.errors = errors;
  }
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

const operationName = (query: string) => /\b(?:query|mutation)\s+(\w+)/.exec(query)?.[1];

/** Resolves with GraphQL errors in `errors`. Rejects only on network failure or abort. */
export async function request<T>(
  query: string,
  variables: Variables,
  signal?: AbortSignal,
): Promise<GraphQLResponse<T>> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables, operationName: operationName(query) }),
    signal,
  });

  let body: { data?: T | null; errors?: { message?: string }[] };
  try {
    body = await res.json();
  } catch {
    return { data: undefined, errors: [`Unexpected response (HTTP ${res.status})`] };
  }

  const errors = (body.errors ?? []).map((e) => e.message ?? 'Unknown error');
  if (!res.ok && errors.length === 0) errors.push(`HTTP ${res.status}`);
  return { data: body.data ?? undefined, errors };
}
