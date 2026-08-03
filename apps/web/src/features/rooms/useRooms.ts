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

export function largestOf(rooms: readonly Room[]): Room | undefined {
  return rooms.reduce<Room | undefined>(
    (largest, room) => (largest === undefined || room.capacity > largest.capacity ? room : largest),
    undefined,
  );
}

/**
 * The unfiltered list, which the screen needs for two things the filtered list
 * cannot answer: which capacity chips are worth offering, and which room the
 * empty state should name. Filtering to «від 12» would otherwise hide every
 * smaller room from both.
 *
 * With no filter active this is the same query key as `useRooms`, so the two
 * collapse into one request; only a filtered view costs a second.
 */
export function useRoomCatalogue() {
  return useQuery({
    queryKey: roomsQueryKey(undefined),
    queryFn: () => fetchRooms(undefined),
    retry: false,
  });
}
