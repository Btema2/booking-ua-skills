// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { jsonResponse, resetHarness, renderApp } from '../../test/harness';
import * as timeUtils from '../rooms/timeUtils';
import { MyBookingsSkeleton } from './MyBookingsPage';

const IVAN = {
  id: '1f2ac0d6-8d61-4a2f-9f5c-7b2b6c0a1d31',
  name: 'Іван',
  email: 'ivan@example.com',
  emailVerifiedAt: null,
};

const activeSession = () => jsonResponse(200, { user: IVAN });
const emptyRooms = () => jsonResponse(200, { rooms: [] });

describe('MyBookingsPage', () => {
  afterEach(() => {
    resetHarness();
    vi.restoreAllMocks();
  });

  it('1. Upcoming and past tabs render their own rows, tab survives reload (via URL search params)', async () => {
    const upcomingBooking = {
      id: 'b-up-1',
      roomId: 1,
      roomName: 'Дуб',
      roomFloor: 2,
      title: 'Майбутнє бронювання',
      startsAt: '2026-08-15T10:00:00.000Z',
      endsAt: '2026-08-15T11:00:00.000Z',
      userId: IVAN.id,
      userName: IVAN.name,
    };

    const pastBooking = {
      id: 'b-past-1',
      roomId: 1,
      roomName: 'Дуб',
      roomFloor: 2,
      title: 'Минуле бронювання',
      startsAt: '2026-08-01T10:00:00.000Z',
      endsAt: '2026-08-01T11:00:00.000Z',
      userId: IVAN.id,
      userName: IVAN.name,
    };

    renderApp('/my-bookings', {
      'GET /api/auth/me': activeSession,
      'GET /api/bookings/mine?status=upcoming&page=1': () =>
        jsonResponse(200, { bookings: [upcomingBooking], total: 1, page: 1, limit: 10, hasMore: false }),
      'GET /api/bookings/mine?status=past&page=1': () =>
        jsonResponse(200, { bookings: [pastBooking], total: 1, page: 1, limit: 10, hasMore: false }),
    });

    // Default tab is upcoming
    expect(await screen.findByText('Майбутнє бронювання')).toBeTruthy();
    expect(screen.queryByText('Минуле бронювання')).toBeNull();

    // Click "Минулі" tab
    const pastTab = screen.getByRole('tab', { name: 'Минулі' });
    fireEvent.click(pastTab);

    expect(await screen.findByText('Минуле бронювання')).toBeTruthy();
    expect(screen.queryByText('Майбутнє бронювання')).toBeNull();
    expect(window.location.search).toContain('tab=past');

    // Reload simulation with ?tab=past
    resetHarness();
    renderApp('/my-bookings?tab=past', {
      'GET /api/auth/me': activeSession,
      'GET /api/bookings/mine?status=past&page=1': () =>
        jsonResponse(200, { bookings: [pastBooking], total: 1, page: 1, limit: 10, hasMore: false }),
    });

    expect(await screen.findByText('Минуле бронювання')).toBeTruthy();
    expect(screen.queryByText('Майбутнє бронювання')).toBeNull();
  });

  it("2. Times render in viewer's zone; assert row's label differs between Europe/Warsaw and Asia/Tokyo", async () => {
    const booking = {
      id: 'b-tz-1',
      roomId: 1,
      roomName: 'Дуб',
      roomFloor: 2,
      title: 'Зустріч з часовим поясом',
      startsAt: '2026-08-10T10:00:00.000Z', // 10:00 UTC
      endsAt: '2026-08-10T11:00:00.000Z',
      userId: IVAN.id,
      userName: IVAN.name,
    };

    // Render in Europe/Warsaw (UTC+2 in August -> 12:00–13:00)
    const spyTz = vi.spyOn(timeUtils, 'getViewerZone').mockReturnValue('Europe/Warsaw');

    renderApp('/my-bookings', {
      'GET /api/auth/me': activeSession,
      'GET /api/bookings/mine?status=upcoming&page=1': () =>
        jsonResponse(200, { bookings: [booking], total: 1, page: 1, limit: 10, hasMore: false }),
    });

    expect(await screen.findByText('Зустріч з часовим поясом')).toBeTruthy();
    const warsawTimeRange = screen.getByText('12:00–13:00');
    expect(warsawTimeRange).toBeTruthy();

    resetHarness();

    // Render in Asia/Tokyo (UTC+9 -> 19:00–20:00)
    spyTz.mockReturnValue('Asia/Tokyo');

    renderApp('/my-bookings', {
      'GET /api/auth/me': activeSession,
      'GET /api/bookings/mine?status=upcoming&page=1': () =>
        jsonResponse(200, { bookings: [booking], total: 1, page: 1, limit: 10, hasMore: false }),
    });

    expect(await screen.findByText('Зустріч з часовим поясом')).toBeTruthy();
    const tokyoTimeRange = screen.getByText('19:00–20:00');
    expect(tokyoTimeRange).toBeTruthy();

    // Assert labels differ
    expect(warsawTimeRange.textContent).not.toBe(tokyoTimeRange.textContent);
  });

  it('3. Clicking row builds correct /rooms/:id?week= URL — include 30 Dec booking with week starting in previous year, and month boundary crossing', async () => {
    // 30 Dec 2020 Wednesday -> Kyiv Monday is 28 Dec 2020
    const dec30Booking = {
      id: 'b-year-end',
      roomId: 1,
      roomName: 'Дуб',
      roomFloor: 2,
      title: 'Новорічна зустріч 2020',
      startsAt: '2020-12-30T10:00:00.000Z',
      endsAt: '2020-12-30T11:00:00.000Z',
      userId: IVAN.id,
      userName: IVAN.name,
    };

    // 1 Sep 2026 Tuesday -> Kyiv Monday is 31 Aug 2026
    const sep1Booking = {
      id: 'b-month-bound',
      roomId: 2,
      roomName: 'Сосна',
      roomFloor: 3,
      title: 'Перше вересня 2026',
      startsAt: '2026-09-01T10:00:00.000Z',
      endsAt: '2026-09-01T11:00:00.000Z',
      userId: IVAN.id,
      userName: IVAN.name,
    };

    renderApp('/my-bookings', {
      'GET /api/auth/me': activeSession,
      'GET /api/bookings/mine?status=upcoming&page=1': () =>
        jsonResponse(200, {
          bookings: [dec30Booking, sep1Booking],
          total: 2,
          page: 1,
          limit: 10,
          hasMore: false,
        }),
      'GET /api/rooms/1/bookings?from=2020-12-28T00%3A00%3A00.000Z&to=2021-01-03T21%3A59%3A59.999Z':
        () => jsonResponse(200, { bookings: [] }),
      'GET /api/rooms/1': () => jsonResponse(200, { id: 1, name: 'Дуб', floor: 2, capacity: 12 }),
      'GET /api/rooms': emptyRooms,
    });

    expect(await screen.findByText('Новорічна зустріч 2020')).toBeTruthy();
    expect(screen.getByText('Перше вересня 2026')).toBeTruthy();

    // Click 30 Dec 2020 row
    const row1 = screen.getByText('Новорічна зустріч 2020').closest('div[class*="cursor-pointer"]');
    expect(row1).toBeTruthy();
    fireEvent.click(row1!);

    expect(window.location.pathname + window.location.search).toBe('/rooms/1?week=2020-12-28&day=2020-12-30');

    resetHarness();

    renderApp('/my-bookings', {
      'GET /api/auth/me': activeSession,
      'GET /api/bookings/mine?status=upcoming&page=1': () =>
        jsonResponse(200, {
          bookings: [dec30Booking, sep1Booking],
          total: 2,
          page: 1,
          limit: 10,
          hasMore: false,
        }),
      'GET /api/rooms/2/bookings?from=2026-08-31T00%3A00%3A00.000Z&to=2026-09-06T20%3A59%3A59.999Z':
        () => jsonResponse(200, { bookings: [] }),
      'GET /api/rooms/2': () => jsonResponse(200, { id: 2, name: 'Сосна', floor: 3, capacity: 8 }),
      'GET /api/rooms': emptyRooms,
    });

    expect(await screen.findByText('Перше вересня 2026')).toBeTruthy();
    const row2 = screen.getByText('Перше вересня 2026').closest('div[class*="cursor-pointer"]');
    expect(row2).toBeTruthy();
    fireEvent.click(row2!);

    expect(window.location.pathname + window.location.search).toBe('/rooms/2?week=2026-08-31&day=2026-09-01');
  });

  it('4. Cancel on upcoming row opens Phase 5 dialog, removes row optimistically, and rejected DELETE restores row', async () => {
    const booking = {
      id: 'b-cancel-1',
      roomId: 1,
      roomName: 'Дуб',
      roomFloor: 2,
      title: 'Скасовне бронювання',
      startsAt: '2026-08-20T10:00:00.000Z',
      endsAt: '2026-08-20T11:00:00.000Z',
      userId: IVAN.id,
      userName: IVAN.name,
    };

    let rejectDelete: (err: any) => void;
    const deletePromise = new Promise((_, rej) => {
      rejectDelete = rej;
    });

    renderApp('/my-bookings', {
      'GET /api/auth/me': activeSession,
      'GET /api/bookings/mine?status=upcoming&page=1': () =>
        jsonResponse(200, { bookings: [booking], total: 1, page: 1, limit: 10, hasMore: false }),
      'DELETE /api/bookings/b-cancel-1': () => deletePromise as any,
    });

    expect(await screen.findByText('Скасовне бронювання')).toBeTruthy();

    const cancelBtn = screen.getByRole('button', { name: 'Скасувати' });
    fireEvent.click(cancelBtn);

    // Dialog opens
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText('Скасувати бронювання?')).toBeTruthy();

    // Confirm cancel
    const confirmBtn = within(dialog).getByRole('button', { name: 'Скасувати бронювання' });
    fireEvent.click(confirmBtn);

    // Optimistically removed from list
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Скасовне бронювання' })).toBeNull();
    });

    // Reject DELETE
    rejectDelete!(new Error('Network error'));

    // Restored back onto list
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Скасовне бронювання' })).toBeTruthy();
    });
  });

  it('5. Past rows expose no cancel control', async () => {
    const pastBooking = {
      id: 'b-past-1',
      roomId: 1,
      roomName: 'Дуб',
      roomFloor: 2,
      title: 'Минуле без кнопки',
      startsAt: '2026-08-01T10:00:00.000Z',
      endsAt: '2026-08-01T11:00:00.000Z',
      userId: IVAN.id,
      userName: IVAN.name,
    };

    renderApp('/my-bookings?tab=past', {
      'GET /api/auth/me': activeSession,
      'GET /api/bookings/mine?status=past&page=1': () =>
        jsonResponse(200, { bookings: [pastBooking], total: 1, page: 1, limit: 10, hasMore: false }),
    });

    expect(await screen.findByText('Минуле без кнопки')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Скасувати' })).toBeNull();
  });

  it('6. Empty state renders and its button navigates to room list', async () => {
    renderApp('/my-bookings', {
      'GET /api/auth/me': activeSession,
      'GET /api/bookings/mine?status=upcoming&page=1': () =>
        jsonResponse(200, { bookings: [], total: 0, page: 1, limit: 10, hasMore: false }),
      'GET /api/rooms': emptyRooms,
    });

    expect(await screen.findByText('Майбутніх бронювань немає')).toBeTruthy();

    const chooseRoomBtn = screen.getByRole('button', { name: 'Обрати кімнату' });
    expect(chooseRoomBtn).toBeTruthy();

    fireEvent.click(chooseRoomBtn);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/rooms');
    });
  });

  it(
    '7. Does not retry a failed GET /api/bookings/mine (retry: false, no silent backoff before the error banner)',
    async () => {
      const { fetchMock } = renderApp('/my-bookings', {
        'GET /api/auth/me': activeSession,
        'GET /api/bookings/mine?status=upcoming&page=1': () =>
          Promise.reject(new Error('network down')) as any,
      });

      // Generous timeout: if retry: false regresses, React Query's client-side
      // default (retry: 3) delays the error banner until all 3 backoffs
      // (1s+2s+4s ≈ 7s) exhaust — the App's own QueryClient (createQueryClient())
      // has no defaultOptions, so nothing but the query's own option can prevent
      // it. The timeout must outlast that so the failure surfaces as a wrong
      // call count below, not a coincidental findByText timeout that would pass
      // without ever exercising the assertion this test exists for.
      expect(await screen.findByText('Не вдалося оновити список', {}, { timeout: 9000 })).toBeTruthy();

      // React Query's client-side default (retry: 3) would fire its first
      // retry ~1000ms after the initial failure (retryDelay(0) = 1000ms).
      // Wait past that window to prove no retry happens with retry: false
      // in place.
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const bookingsCalls = fetchMock.mock.calls.filter(
        ([input]) => String(input) === '/api/bookings/mine?status=upcoming&page=1',
      );
      expect(bookingsCalls).toHaveLength(1);
    },
    15000,
  );

  it('renders MyBookingsSkeleton status region with row card placeholders', () => {
    render(<MyBookingsSkeleton />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByLabelText('Завантаження')).toBeTruthy();
  });
});
