import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DateTime } from 'luxon';
import {
  getCurrentKyivWeek,
  getHourLabelsForGutter,
  getBookingGridRow,
} from './timeUtils';
import { BookingBlock } from './BookingBlock';

describe('Week Grid Requirements (Phase 4a)', () => {
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
    const kyivLabels = getHourLabelsForGutter(daysKyiv, 'Europe/Kyiv');
    const tokyoLabels = getHourLabelsForGutter(daysKyiv, 'Asia/Tokyo');

    expect(kyivLabels[0]).toBe('09:00');
    expect(tokyoLabels[0]).not.toBe(kyivLabels[0]);
  });
});
