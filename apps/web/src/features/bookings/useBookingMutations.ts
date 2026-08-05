import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Booking } from '@booking/core';
import { apiRequest, postJson } from '../../lib/api';
import { useCurrentUser } from '../auth/useCurrentUser';

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

export function useCancelBooking(roomId: string, weekStartISO: string) {
  const queryClient = useQueryClient();
  const queryKey = ['room', roomId, 'bookings', weekStartISO];

  return useMutation({
    mutationFn: (bookingId: string) =>
      apiRequest<void>(`/bookings/${bookingId}`, { method: 'DELETE' }),
    onMutate: async (bookingId: string) => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<{ bookings: Booking[] }>(queryKey);

      if (previousData) {
        queryClient.setQueryData<{ bookings: Booking[] }>(queryKey, {
          ...previousData,
          bookings: previousData.bookings.filter((booking) => booking.id !== bookingId),
        });
      }

      return { previousData };
    },
    onError: (_err, _bookingId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
