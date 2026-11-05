import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, GraphQLRequestError, request, type Variables } from './transport';

export type UseMutationResult<TData, TVars> = {
  loading: boolean;
  errors: string[];
  mutateData: (variables?: TVars, replace?: boolean) => Promise<TData | undefined>;
};

export type MutationOptions<TVars> = {
  variables?: TVars;
  // Off by default so a fire-and-forget click handler can't cause an unhandled rejection.
  throwError?: boolean;
};

export function useMutation<TData, TVars extends Variables = Variables>(
  query: string,
  options: MutationOptions<TVars> = {},
): UseMutationResult<TData, TVars> {
  const [state, setState] = useState({ loading: false, errors: [] as string[] });
  const latestCall = useRef(0);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const mutateData = useCallback(
    async (next?: TVars, replace = false) => {
      const call = ++latestCall.current;
      const variables = replace ? (next ?? {}) : { ...optionsRef.current.variables, ...next };
      setState({ loading: true, errors: [] });

      let data: TData | undefined;
      let errors: string[];
      try {
        ({ data, errors } = await request<TData>(query, variables));
      } catch (e) {
        data = undefined;
        errors = [errorMessage(e)];
      }

      if (call === latestCall.current) setState({ loading: false, errors });
      if (errors.length && optionsRef.current.throwError) throw new GraphQLRequestError(errors);
      return data;
    },
    [query],
  );

  return { ...state, mutateData };
}
