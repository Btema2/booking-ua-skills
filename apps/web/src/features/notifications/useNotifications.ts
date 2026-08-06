import { useQuery } from '@tanstack/react-query';
import { fetchNotifications } from './api';

export const notificationsQueryKey = ['notifications'] as const;

// Well under the server default NOTIFY_BEFORE_MINUTES (10 min), so the bell
// and toast pick up a fresh notification with low latency without a socket.
const POLL_INTERVAL_MS = 15_000;

export function useNotifications() {
  return useQuery({
    queryKey: notificationsQueryKey,
    queryFn: fetchNotifications,
    refetchInterval: POLL_INTERVAL_MS,
  });
}
