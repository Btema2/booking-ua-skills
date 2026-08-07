import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Booking } from '@booking/core';
import { CancelBookingDialog } from './CancelBookingDialog';

afterEach(() => {
  cleanup();
});

const SINGLE_BOOKING: Booking = {
  id: 'booking-1',
  roomId: 1,
  title: 'Одноразова подія',
  startsAt: new Date('2026-01-07T07:00:00.000Z'),
  endsAt: new Date('2026-01-07T08:00:00.000Z'),
  userId: 'user-1',
  userName: 'Іван',
  seriesId: null,
};

const SERIES_BOOKING: Booking = {
  ...SINGLE_BOOKING,
  id: 'booking-2',
  seriesId: 'series-1',
};

function baseProps(booking: Booking) {
  return {
    isOpen: true,
    booking,
    roomName: 'Переговорна 1',
    viewerZone: 'Europe/Kyiv',
    onClose: vi.fn(),
    isDeleting: false,
    error: null,
  };
}

describe('CancelBookingDialog', () => {
  it('renders nothing when isOpen is false', () => {
    const onConfirm = vi.fn();
    const { container } = render(<CancelBookingDialog {...baseProps(SINGLE_BOOKING)} isOpen={false} onConfirm={onConfirm} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onConfirm with no scope for a non-series booking, and shows no scope choice', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<CancelBookingDialog {...baseProps(SINGLE_BOOKING)} onConfirm={onConfirm} />);

    expect(screen.queryByLabelText('це бронювання')).toBeNull();
    expect(screen.queryByLabelText('уся серія')).toBeNull();
  });

  it('shows a this-vs-series choice for a series booking, defaulting to "це бронювання"', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<CancelBookingDialog {...baseProps(SERIES_BOOKING)} onConfirm={onConfirm} />);

    const thisRadio = screen.getByLabelText('це бронювання') as HTMLInputElement;
    expect(thisRadio.checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Скасувати бронювання' }));

    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it('calls onConfirm with scope="series" when "уся серія" is selected', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<CancelBookingDialog {...baseProps(SERIES_BOOKING)} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByLabelText('уся серія'));
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати бронювання' }));

    expect(onConfirm).toHaveBeenCalledWith('series');
  });
});
