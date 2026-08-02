import { useQuery } from '@tanstack/react-query';
import { fetchCurrentUser } from './api';

export const currentUserQueryKey = ['auth', 'me'] as const;

/**
 * The single source of truth for "who is signed in".
 * `retry: false` because an anonymous visitor is a normal state, not a flake —
 * `fetchCurrentUser` already folds a 401 into `null`.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: fetchCurrentUser,
    retry: false,
  });
}
