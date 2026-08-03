import { useQuery } from '@tanstack/react-query';
import type { Room } from '@booking/core';
import { fetchRooms } from './api';

function roomsQueryKey(minCapacity: number | undefined) {
  return ['rooms', minCapacity] as const;
}

/**
 * `retry: false` because the error state offers an explicit «Повторити»; three
 * silent retries would only delay it by several seconds.
 */
export function useRooms(minCapacity: number | undefined) {
  return useQuery({
    queryKey: roomsQueryKey(minCapacity),
    queryFn: () => fetchRooms(minCapacity),
    retry: false,
  });
}

function largestOf(rooms: readonly Room[]): Room | undefined {
  return rooms.reduce<Room | undefined>(
    (largest, room) => (largest === undefined || room.capacity > largest.capacity ? room : largest),
    undefined,
  );
}

/**
 * The empty state has to name a real room, so it reads the *unfiltered* list.
 * That is the same query key the screen loads first, so this is usually a cache
 * hit; `enabled` keeps it from firing until an empty result actually needs it
 * (which is what makes a deep link straight to `?minCapacity=20` still honest).
 */
export function useLargestRoom(enabled: boolean): Room | undefined {
  const { data } = useQuery({
    queryKey: roomsQueryKey(undefined),
    queryFn: () => fetchRooms(undefined),
    retry: false,
    enabled,
  });
  return data === undefined ? undefined : largestOf(data);
}
