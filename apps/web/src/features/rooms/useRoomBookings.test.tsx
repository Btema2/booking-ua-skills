import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { fetchRoomBookings, useRoomBookings, useRoomDetails } from './useRoomBookings';
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

    it(
      'does not retry a failed fetch, even under a QueryClient with no retry override (own retry: false)',
      async () => {
        // Deliberately NOT using createWrapper() here: its QueryClient sets
        // retry: false at the client level, which would mask a regression if
        // useRoomBookings's own retry: false were ever reverted (the client
        // default would still suppress retries and the test would pass either
        // way). This wrapper has no defaultOptions at all, so the only thing
        // that can prevent a retry here is the hook's own option.
        const queryClient = new QueryClient();
        const wrapper = ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        );

        const mockFetch = vi.fn().mockRejectedValue(new Error('network down'));
        vi.stubGlobal('fetch', mockFetch);

        const { result } = renderHook(() => useRoomBookings('42'), { wrapper });

        // Generous timeout: if retry: false regresses, React Query's client-side
        // default (retry: 3) delays isError until all 3 backoffs (1s+2s+4s ≈ 7s)
        // exhaust. The timeout must outlast that so the failure surfaces as a
        // wrong call count below, not a coincidental waitFor timeout that would
        // pass without ever exercising the assertion this test exists for.
        await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 9000 });

        // React Query's client-side default (retry: 3) would fire its first
        // retry ~1000ms after the initial failure (retryDelay(0) = 1000ms).
        // Wait past that window to prove no retry happens with the hook's own
        // retry: false in place.
        await new Promise((resolve) => setTimeout(resolve, 1500));

        expect(mockFetch).toHaveBeenCalledTimes(1);
      },
      15000,
    );
  });

  describe('useRoomDetails hook', () => {
    it('finds room details from room catalogue', async () => {
      const roomsMock = [
        { id: 42, name: 'Дуб', floor: 2, capacity: 12, amenities: null },
        { id: 43, name: 'Ясен', floor: 2, capacity: 8, amenities: null },
      ];
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ rooms: roomsMock }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useRoomDetails('42'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isPending).toBe(false));
      expect(result.current.data).toEqual(roomsMock[0]);
    });
  });
});
