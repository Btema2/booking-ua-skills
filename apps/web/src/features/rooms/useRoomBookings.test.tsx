import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { fetchRoomBookings, fetchRoomDetails, useRoomBookings, useRoomDetails } from './useRoomBookings';
import { getCurrentKyivWeek } from './timeUtils';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useRoomBookings', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchRoomBookings', () => {
    it('calls GET /api/rooms/:roomId/bookings with encoded from and to params', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ bookings: [] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await fetchRoomBookings('42', '2026-08-03T00:00:00.000Z', '2026-08-09T23:59:59.999Z');

      expect(result).toEqual({ bookings: [] });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/rooms/42/bookings?from=2026-08-03T00%3A00%3A00.000Z&to=2026-08-09T23%3A59%3A59.999Z',
        expect.objectContaining({ credentials: 'include' }),
      );
    });
  });

  describe('fetchRoomDetails', () => {
    it('calls GET /api/rooms/:roomId', async () => {
      const roomMock = { id: 42, name: 'Дуб', floor: 2, capacity: 12, amenities: null };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => roomMock,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await fetchRoomDetails('42');

      expect(result).toEqual(roomMock);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/rooms/42',
        expect.objectContaining({ credentials: 'include' }),
      );
    });
  });

  describe('useRoomBookings hook', () => {
    it('queries room bookings using current week boundaries', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ bookings: [] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useRoomBookings('42'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const { fromISO, toISO } = getCurrentKyivWeek();
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/rooms/42/bookings?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`,
        expect.anything(),
      );
    });
  });

  describe('useRoomDetails hook', () => {
    it('queries room details', async () => {
      const roomMock = { id: 42, name: 'Дуб', floor: 2, capacity: 12, amenities: null };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => roomMock,
      });
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useRoomDetails('42'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(roomMock);
    });
  });
});
