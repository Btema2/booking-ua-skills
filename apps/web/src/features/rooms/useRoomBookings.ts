import { useQuery } from '@tanstack/react-query';
import type { Booking } from '@booking/core';
import { apiRequest } from '../../lib/api';
import { getCurrentKyivWeek, type KyivWeek } from './timeUtils';
import { useRoomCatalogue } from './useRooms';

export async function fetchRoomBookings(
  roomId: string,
  fromISO: string,
  toISO: string,
): Promise<{ bookings: Booking[] }> {
  return apiRequest<{ bookings: Booking[] }>(
    `/rooms/${roomId}/bookings?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`,
  );
}

/**
 * `retry: false` because the error state offers an explicit «Оновити зараз»; three
 * silent retries would only delay it by several seconds.
 */
export function useRoomBookings(roomId: string, weekInfo?: KyivWeek) {
  const currentWeek = weekInfo ?? getCurrentKyivWeek();
  const { fromISO, toISO, weekStartISO } = currentWeek;
  return useQuery({
    queryKey: ['room', roomId, 'bookings', weekStartISO],
    queryFn: () => fetchRoomBookings(roomId, fromISO, toISO),
    enabled: Boolean(roomId),
    retry: false,
  });
}

export function useRoomDetails(roomId: string) {
  const catalogueQuery = useRoomCatalogue();
  const room = catalogueQuery.data?.find((r) => String(r.id) === String(roomId));
  return {
    data: room,
    isPending: catalogueQuery.isPending,
    isError: catalogueQuery.isError,
    refetch: catalogueQuery.refetch,
  };
}
