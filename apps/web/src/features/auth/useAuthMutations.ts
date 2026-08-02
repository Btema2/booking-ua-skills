import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { PublicUser } from '@booking/core';
import { loginUser, logoutUser, registerUser } from './api';
import { currentUserQueryKey } from './useCurrentUser';

/**
 * Seeds the current-user cache from a mutation result so the route guards react
 * immediately, without a second /auth/me round trip or a page reload.
 */
function useSeedCurrentUser() {
  const queryClient = useQueryClient();
  return useCallback(
    (user: PublicUser | null) => {
      queryClient.setQueryData(currentUserQueryKey, user);
    },
    [queryClient],
  );
}

export function useRegisterMutation() {
  const seedCurrentUser = useSeedCurrentUser();
  return useMutation({ mutationFn: registerUser, onSuccess: seedCurrentUser });
}

export function useLoginMutation() {
  const seedCurrentUser = useSeedCurrentUser();
  return useMutation({ mutationFn: loginUser, onSuccess: seedCurrentUser });
}

export function useLogoutMutation() {
  const seedCurrentUser = useSeedCurrentUser();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: logoutUser,
    // Logout is idempotent server-side, so even a failed request still means the
    // user asked to leave: drop the cached session and send them out either way.
    onSettled: () => {
      seedCurrentUser(null);
      navigate('/login', { replace: true });
    },
  });
}
