import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Booking, Room } from '@booking/core';
import { RoomSchedulePage } from './RoomSchedulePage';
import { BookingBlock } from './BookingBlock';
import * as useRoomBookingsModule from './useRoomBookings';
import * as useCurrentUserModule from '../auth/useCurrentUser';

const mockRoom: Room = {
  id: 1,
  name: 'Акваріум',
  floor: 2,
  capacity: 8,
  amenities: 'Проєктор',
};

const mockOwnBooking: Booking = {
  id: 'b1111111-1111-1111-1111-111111111111',
  roomId: 1,
  title: 'Моя зустріч',
  startsAt: new Date('2026-08-05T10:00:00.000Z'),
  endsAt: new Date('2026-08-05T11:00:00.000Z'),
  userId: 'u1111111-1111-1111-1111-111111111111',
  userName: 'Оксана Сергієнко',
};

const mockOtherBooking: Booking = {
  id: 'b2222222-2222-2222-2222-222222222222',
  roomId: 1,
  title: 'Чужа зустріч',
  startsAt: new Date('2026-08-05T12:00:00.000Z'),
  endsAt: new Date('2026-08-05T13:00:00.000Z'),
  userId: 'u9999999-9999-9999-9999-999999999999',
  userName: 'Василь Петренко',
};

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('Phase 7 Mobile Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.spyOn(useRoomBookingsModule, 'useRoomDetails').mockReturnValue({
      data: mockRoom,
      isPending: false,
      isError: false,
    } as any);

    vi.spyOn(useRoomBookingsModule, 'useRoomBookings').mockReturnValue({
      data: { bookings: [mockOwnBooking, mockOtherBooking] },
      isPending: false,
      isError: false,
    } as any);

    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { id: 'u1111111-1111-1111-1111-111111111111', name: 'Оксана Сергієнко' },
      isPending: false,
      isError: false,
    } as any);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('1. Below 761px the pager renders and the 7-column week grid does not; at 761px and above the reverse', () => {
    // Below 761px (e.g. 390px)
    setViewportWidth(390);

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/rooms/1']}>
          <Routes>
            <Route path="/rooms/:roomId" element={<RoomSchedulePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('mobile-day-pager')).toBeTruthy();
    expect(screen.queryByTestId('week-grid-gutter')).toBeNull();

    // At 761px and above
    setViewportWidth(761);

    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/rooms/1']}>
          <Routes>
            <Route path="/rooms/:roomId" element={<RoomSchedulePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.queryByTestId('mobile-day-pager')).toBeNull();
    expect(screen.getByTestId('week-grid-gutter')).toBeTruthy();
  });

  it('2. Selecting a day updates the URL and survives a remount', () => {
    setViewportWidth(390);

    let testLocation: Location | undefined;

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/rooms/1?week=2026-W32']}>
          <Routes>
            <Route path="/rooms/:roomId" element={<RoomSchedulePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Initial load: 7 day tabs are rendered
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(7);

    // Click Wednesday (index 2)
    fireEvent.click(tabs[2]);

    expect(tabs[2].getAttribute('aria-selected')).toBe('true');

    // Unmount and remount with the updated URL param (day=2026-08-05)
    unmount();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/rooms/1?week=2026-W32&day=2026-08-05']}>
          <Routes>
            <Route path="/rooms/:roomId" element={<RoomSchedulePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const remountedTabs = screen.getAllByRole('tab');
    expect(remountedTabs[2].getAttribute('aria-selected')).toBe('true');
  });

  it('3. The mobile day column renders 20 rows and its gutter labels, including on a day with no bookings', () => {
    setViewportWidth(390);

    vi.spyOn(useRoomBookingsModule, 'useRoomBookings').mockReturnValue({
      data: { bookings: [] },
      isPending: false,
      isError: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/rooms/1']}>
          <Routes>
            <Route path="/rooms/:roomId" element={<RoomSchedulePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const gutter = screen.getByTestId('mobile-grid-gutter');
    expect(gutter).toBeTruthy();
    expect(gutter.children.length).toBe(20);

    const hourLabels = screen.getAllByTestId('gutter-hour-label');
    expect(hourLabels.length).toBe(10); // 10 hour labels for 20 half-hour rows
  });

  it('4. Free rows on mobile render a visible + without hover', () => {
    setViewportWidth(390);

    render(
      <BookingBlock isMobile={true} viewerZone="Europe/Kyiv" startRow={1} span={1} />,
    );

    const plus = screen.getByText('+');
    expect(plus).toBeTruthy();
    // In mobile mode, + text is not hidden behind group-hover opacity-0
    expect(plus.className).not.toContain('opacity-0');
    expect(plus.className).toContain('text-[14px]');

    const pillDiv = plus.parentElement;
    expect(pillDiv?.className).toContain('rounded-full');
    expect(pillDiv?.className).toContain('border-[1.5px]');
    expect(pillDiv?.className).toContain('border-dashed');
  });

  it('5. Own vs other booking still carries all four non-colour signals at mobile sizes', () => {
    setViewportWidth(390);

    // Render own booking on mobile
    const { rerender } = render(
      <BookingBlock
        booking={mockOwnBooking}
        currentUserId="u1111111-1111-1111-1111-111111111111"
        viewerZone="Europe/Kyiv"
        isMobile={true}
        startRow={1}
        span={2}
      />,
    );

    const ownButton = screen.getByRole('button');
    // Signal 1: 2px solid primary border
    expect(ownButton.className).toContain('border-2');
    expect(ownButton.className).toContain('border-primary');
    // Signal 2: filled dot
    const dot = ownButton.querySelector('.rounded-full.bg-primary');
    expect(dot).toBeTruthy();
    // Signal 3: literal word "Ви"
    expect(screen.getByText(/Ви ·/)).toBeTruthy();

    // Render other booking on mobile
    rerender(
      <BookingBlock
        booking={mockOtherBooking}
        currentUserId="u1111111-1111-1111-1111-111111111111"
        viewerZone="Europe/Kyiv"
        isMobile={true}
        startRow={3}
        span={2}
      />,
    );

    const otherCard = screen.getByText('Чужа зустріч').closest('div.border-l-\\[4px\\]');
    expect(otherCard).toBeTruthy();
    // Signal 1: 1px border + 4px left bar secondary
    expect(otherCard?.className).toContain('border-l-[4px]');
    expect(otherCard?.className).toContain('border-l-secondary');
    // Signal 2: outline person glyph (SVG)
    const personSvg = otherCard?.querySelector('svg');
    expect(personSvg).toBeTruthy();
    // Signal 3: owner's first name ("Василь")
    expect(screen.getByText(/Василь ·/)).toBeTruthy();
  });

  it('6. Navigating with week and day params selects the exact day on mobile without breaking desktop full week view', () => {
    // On mobile (< 761px), day=2026-08-05 (Wednesday) is active tab
    setViewportWidth(390);

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/rooms/1?week=2026-08-03&day=2026-08-05']}>
          <Routes>
            <Route path="/rooms/:roomId" element={<RoomSchedulePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');

    // On desktop (>= 761px), full week grid is rendered
    setViewportWidth(761);

    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/rooms/1?week=2026-08-03&day=2026-08-05']}>
          <Routes>
            <Route path="/rooms/:roomId" element={<RoomSchedulePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.queryByTestId('mobile-day-pager')).toBeNull();
    expect(screen.getByTestId('week-grid-gutter')).toBeTruthy();
  });
});
