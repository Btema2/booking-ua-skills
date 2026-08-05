import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import {
  getCurrentKyivWeek,
  getKyivWeek,
  getViewerZone,
  getHourLabelsForGutter,
  getBookingGridRow,
} from './timeUtils';
import { BookingBlock } from './BookingBlock';
import { RoomSchedulePage } from './RoomSchedulePage';

vi.mock('./useRoomBookings', () => ({
  useRoomDetails: () => ({
    data: { id: '1', name: 'Тестова кімната', floor: 2, capacity: 6, amenities: 'Маркерна дошка' },
    isPending: false,
    isError: false,
  }),
  useRoomBookings: () => ({
    data: { bookings: [] },
    isPending: false,
    isError: false,
  }),
}));

describe('Week Grid Requirements (Phase 4a)', () => {
  afterEach(cleanup);
  // Test 1: A 09:00–10:00 Kyiv booking occupies grid-row span 2, starting at row 1.
  it('1. A 09:00–10:00 Kyiv booking occupies grid-row span 2, starting at row 1', () => {
    const mondayKyiv = DateTime.now().setZone('Europe/Kyiv').startOf('week');
    const start0900 = mondayKyiv.set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
    const end1000 = mondayKyiv.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });

    const pos = getBookingGridRow(start0900.toUTC().toISO()!, end1000.toUTC().toISO()!);

    expect(pos.startRow).toBe(1);
    expect(pos.span).toBe(2);
  });

  // Test 2: A 4-hour booking spans 8 rows.
  it('2. A 4-hour booking spans 8 rows', () => {
    const mondayKyiv = DateTime.now().setZone('Europe/Kyiv').startOf('week');
    const start0900 = mondayKyiv.set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
    const end1300 = mondayKyiv.set({ hour: 13, minute: 0, second: 0, millisecond: 0 });

    const pos = getBookingGridRow(start0900.toUTC().toISO()!, end1300.toUTC().toISO()!);

    expect(pos.span).toBe(8);
  });

  // Test 3: Two back-to-back bookings produce two separate blocks, no gap row.
  it('3. Two back-to-back bookings produce two separate blocks, no gap row', () => {
    const mondayKyiv = DateTime.now().setZone('Europe/Kyiv').startOf('week');
    const b1Start = mondayKyiv.set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
    const b1End = mondayKyiv.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
    const b2Start = mondayKyiv.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
    const b2End = mondayKyiv.set({ hour: 11, minute: 0, second: 0, millisecond: 0 });

    const pos1 = getBookingGridRow(b1Start.toUTC().toISO()!, b1End.toUTC().toISO()!);
    const pos2 = getBookingGridRow(b2Start.toUTC().toISO()!, b2End.toUTC().toISO()!);

    expect(pos1.startRow).toBe(1);
    expect(pos1.span).toBe(2);
    // 1 + 2 = 3: second booking starts immediately on row 3 with no gap row
    expect(pos2.startRow).toBe(3);
    expect(pos2.span).toBe(2);
  });

  // Test 4: A booking whose userId matches current user renders "Ви"; another user's renders first name.
  it('4. A booking whose userId matches current user renders "Ви"; another user\'s renders first name', () => {
    const currentUserId = 'user-123';
    const monday = DateTime.now().setZone('Europe/Kyiv').startOf('week');

    const ownBooking = {
      id: 'b1111111-1111-1111-1111-111111111111',
      roomId: 1,
      title: 'Own Meeting',
      startsAt: monday.set({ hour: 9, minute: 0 }).toJSDate(),
      endsAt: monday.set({ hour: 10, minute: 0 }).toJSDate(),
      userId: 'user-123',
      userName: 'Іван Петренко',
    };

    const otherBooking = {
      id: 'b2222222-2222-2222-2222-222222222222',
      roomId: 1,
      title: 'Other Meeting',
      startsAt: monday.set({ hour: 11, minute: 0 }).toJSDate(),
      endsAt: monday.set({ hour: 12, minute: 0 }).toJSDate(),
      userId: 'user-456',
      userName: 'Тарас Шевченко',
    };

    const { rerender } = render(
      <BookingBlock booking={ownBooking} currentUserId={currentUserId} startRow={1} span={2} />,
    );
    expect(screen.getByText(/Ви ·/)).toBeTruthy();

    rerender(
      <BookingBlock booking={otherBooking} currentUserId={currentUserId} startRow={5} span={2} />,
    );
    expect(screen.getByText(/Тарас ·/)).toBeTruthy();
  });

  // Test 5: Row labels computed per-instant: assert that with viewer zone Asia/Tokyo first row label differs from Europe/Kyiv label.
  it('5. Row labels computed per-instant: Asia/Tokyo first row label differs from Europe/Kyiv label', () => {
    const { daysKyiv } = getCurrentKyivWeek();
    const kyivLabels = getHourLabelsForGutter(daysKyiv[0], 'Europe/Kyiv');
    const tokyoLabels = getHourLabelsForGutter(daysKyiv[0], 'Asia/Tokyo');

    expect(kyivLabels[0]).toBe('09:00');
    expect(tokyoLabels[0]).not.toBe(kyivLabels[0]);
  });

  // Test 6: The week in the URL search param survives a remount.
  it('6. The week in the URL search param survives a remount', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/room/1?week=2026-08-17']}>
          <Routes>
            <Route path="/room/:roomId" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const { unmount } = render(<RoomSchedulePage />, { wrapper });
    expect(await screen.findByText(/17 серпня — 23 серпня/)).toBeTruthy();

    unmount();

    render(<RoomSchedulePage />, { wrapper });
    expect(await screen.findByText(/17 серпня — 23 серпня/)).toBeTruthy();
  });

  // Test 7: A week whose bookings response is [] still renders 20 rows, 7 day headers each with a date number, the gutter labels, and the caption — with no overlay covering the grid.
  it('7. A week whose bookings response is [] still renders 20 rows, 7 day headers each with a date number, and the gutter labels, plus the caption', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/room/1?week=2026-09-14']}>
          <Routes>
            <Route path="/room/:roomId" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const { container } = render(<RoomSchedulePage />, { wrapper });

    // Assert the empty-state caption is present, in the legend row — not an overlay
    expect(screen.getByText('Цього тижня бронювань немає')).toBeTruthy();
    expect(screen.queryByText('Цього тижня все вільно')).toBeNull();

    // Assert 7 day headers each with date number (14 to 20 for 2026-09-14 week)
    expect(screen.getByText('14')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.getByText('16')).toBeTruthy();
    expect(screen.getByText('17')).toBeTruthy();
    expect(screen.getByText('18')).toBeTruthy();
    expect(screen.getByText('19')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();

    // Assert gutter labels (computed per viewer zone, one label per day column)
    const { daysKyiv } = getKyivWeek('2026-09-14');
    const expectedGutter = getHourLabelsForGutter(daysKyiv[0], getViewerZone());
    expect(screen.getAllByText(expectedGutter[0]).length).toBe(7);
    expect(screen.getAllByText(expectedGutter[expectedGutter.length - 1]).length).toBe(7);

    // The shared time-gutter column was removed (labels now live inside each
    // day column), so no [role="rowheader"] elements remain. Day headers are
    // the empty "Час" gutter cell + the 7 day-name cells = 8 columnheaders,
    // and the 7 day columns still each expose 20 interactive rows (140 cells).
    const columnHeaders = container.querySelectorAll('[role="columnheader"]');
    expect(columnHeaders.length).toBe(8);

    // Assert nothing covers or blocks the grid: every free slot in this
    // future week renders as a normal, clickable gridcell (7 days * 20 rows).
    const gridcells = container.querySelectorAll('[role="gridcell"]');
    expect(gridcells.length).toBe(140);
    expect(container.querySelector('.z-30')).toBeNull();
  });
});
