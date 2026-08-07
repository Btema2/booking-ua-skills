import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Booking } from '@booking/core';
import { apiRequest, postJson } from '../../lib/api';
import { useCurrentUser } from '../auth/useCurrentUser';

export interface BookingSeriesResult {
  series: { id: string };
  created: Booking[];
  skipped: { startsAt: string; endsAt: string }[];
}

export function useCreateBooking(roomId: string, weekStartISO: string) {
  const queryClient = useQueryClient();
  const currentUserQuery = useCurrentUser();
  const currentUser = currentUserQuery.data;
  const queryKey = ['room', roomId, 'bookings', weekStartISO];

  return useMutation({
    mutationFn: (data: unknown) => postJson<Booking>('/bookings', data),
    onMutate: async (newBookingData: any) => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<{ bookings: Booking[] }>(queryKey);
      const tempId = newBookingData?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `temp-${Date.now()}`);

      if (previousData) {
        const optimisticBooking: Booking = {
          id: tempId,
          roomId: Number(newBookingData?.roomId ?? roomId),
          title: newBookingData?.title ?? '',
          startsAt: newBookingData?.startsAt instanceof Date ? newBookingData.startsAt : new Date(newBookingData?.startsAt ?? Date.now()),
          endsAt: newBookingData?.endsAt instanceof Date ? newBookingData.endsAt : new Date(newBookingData?.endsAt ?? Date.now()),
          userId: currentUser?.id ?? '',
          userName: currentUser?.name ?? '',
          ...newBookingData,
        };

        queryClient.setQueryData<{ bookings: Booking[] }>(queryKey, {
          ...previousData,
          bookings: [...previousData.bookings, optimisticBooking],
        });
      }

      return { previousData, tempId };
    },
    onSuccess: (realBooking, _variables, context) => {
      const currentData = queryClient.getQueryData<{ bookings: Booking[] }>(queryKey);
      if (currentData && realBooking) {
        queryClient.setQueryData<{ bookings: Booking[] }>(queryKey, {
          ...currentData,
          bookings: currentData.bookings.map((b) => (b.id === context?.tempId ? realBooking : b)),
        });
      }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// `_weekStartISO` is unused: unlike the other two hooks, this one invalidates
// every cached week (a series spans many), not just the current one. Kept as
// a parameter anyway so the call site reads the same as its two siblings.
export function useCreateBookingSeries(roomId: string, _weekStartISO: string) {
  const queryClient = useQueryClient();
  // Prefix key, not the current week's exact key — a series can create
  // occurrences across many future weeks, each cached separately.
  const roomBookingsPrefix = ['room', roomId, 'bookings'];

  return useMutation({
    mutationFn: (data: unknown) => postJson<BookingSeriesResult>('/bookings/series', data),
    onSuccess: () => {
      // No optimistic update here — a series can partially conflict, so the
      // only correct post-state is whatever the server actually persisted.
      void queryClient.invalidateQueries({ queryKey: roomBookingsPrefix });
    },
  });
}

export function useCancelBooking(roomId: string, weekStartISO: string) {
  const queryClient = useQueryClient();
  const queryKey = ['room', roomId, 'bookings', weekStartISO];
  const roomBookingsPrefix = ['room', roomId, 'bookings'];

  return useMutation({
    mutationFn: ({ bookingId, scope }: { bookingId: string; scope?: 'series' }) =>
      apiRequest<void>(`/bookings/${bookingId}${scope ? `?scope=${scope}` : ''}`, { method: 'DELETE' }),
    onMutate: async ({ bookingId, scope }: { bookingId: string; scope?: 'series' }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<{ bookings: Booking[] }>(queryKey);

      if (previousData) {
        // Look up the target's seriesId once, outside the filter callback —
        // filtering is O(n), and re-running `.find` per item made this O(n^2)
        // for no reason. If the target isn't in this week's cache at all
        // (e.g. cancelling an occurrence from a week the grid hasn't loaded
        // yet), this optimistic step is a no-op and `onSettled` below still
        // invalidates for correctness.
        const target = previousData.bookings.find((b) => b.id === bookingId);
        queryClient.setQueryData<{ bookings: Booking[] }>(queryKey, {
          ...previousData,
          bookings:
            scope === 'series' && target?.seriesId
              ? previousData.bookings.filter((booking) => booking.seriesId !== target.seriesId)
              : previousData.bookings.filter((booking) => booking.id !== bookingId),
        });
      }

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: (_data, _error, { scope }) => {
      // scope=series can touch occurrences in other cached weeks besides
      // this one — invalidate the whole room's prefix in that case, not
      // just the exact key this mutation happened to be constructed with.
      void queryClient.invalidateQueries({ queryKey: scope === 'series' ? roomBookingsPrefix : queryKey });
    },
  });
}
