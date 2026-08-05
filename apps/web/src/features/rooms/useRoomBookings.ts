import { useQuery } from '@tanstack/react-query';
import type { Booking, Room } from '@booking/core';
import { apiRequest } from '../../lib/api';
import { getCurrentKyivWeek } from './timeUtils';

export async function fetchRoomBookings(
  roomId: string,
  fromISO: string,
  toISO: string,
): Promise<{ bookings: Booking[] }> {
  return apiRequest<{ bookings: Booking[] }>(
    `/rooms/${roomId}/bookings?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`,
  );
}

export async function fetchRoomDetails(roomId: string): Promise<Room> {
  return apiRequest<Room>(`/rooms/${roomId}`);
}

export function useRoomBookings(roomId: string) {
  const { fromISO, toISO, weekStartISO } = getCurrentKyivWeek();
  return useQuery({
    queryKey: ['room', roomId, 'bookings', weekStartISO],
    queryFn: () => fetchRoomBookings(roomId, fromISO, toISO),
    enabled: Boolean(roomId),
  });
}

export function useRoomDetails(roomId: string) {
  return useQuery({
    queryKey: ['room', roomId],
    queryFn: () => fetchRoomDetails(roomId),
    enabled: Boolean(roomId),
  });
}
