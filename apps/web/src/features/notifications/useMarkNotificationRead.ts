import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markNotificationRead } from './api';
import { notificationsQueryKey } from './useNotifications';

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });
}
