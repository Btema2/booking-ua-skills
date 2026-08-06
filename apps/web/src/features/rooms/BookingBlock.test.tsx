import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Booking } from '@booking/core';
import { BookingBlock } from './BookingBlock';

const mockBooking: Booking = {
  id: 'b1111111-1111-1111-1111-111111111111',
  roomId: 1,
  title: 'Планування спринту',
  startsAt: new Date('2026-08-05T10:00:00.000Z'),
  endsAt: new Date('2026-08-05T11:00:00.000Z'),
  userId: 'u1111111-1111-1111-1111-111111111111',
  userName: 'Тарас Шевченко',
};

describe('BookingBlock', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders my booking as a clickable button with correct styling and metadata', () => {
    const handleClick = vi.fn();
    const currentUserId = 'u1111111-1111-1111-1111-111111111111';

    render(
      <BookingBlock
        booking={mockBooking}
        currentUserId={currentUserId}
        viewerZone="Europe/Kyiv"
        startRow={1}
        span={2}
        onClick={handleClick}
      />,
    );

    const button = screen.getByRole('button');
    expect(button).toBeTruthy();
    expect(button.className).toContain('border-2');
    expect(button.className).toContain('border-primary');
    expect(button.className).toContain('bg-primary-container');
    expect(button.className).toContain('text-on-primary-container');
    expect(button.className).toContain('rounded-[9px]');
    expect(button.className).toContain('px-[9px] py-[7px]');

    expect(screen.getByText('Ви · 13:00–14:00')).toBeTruthy();
    expect(screen.getByText('Планування спринту')).toBeTruthy();

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('fires onClick from the outer gridcell wrapper directly (roving-tabindex Enter/Space clicks this element, not the inner button)', () => {
    const handleClick = vi.fn();
    const currentUserId = 'u1111111-1111-1111-1111-111111111111';

    const { container } = render(
      <BookingBlock
        booking={mockBooking}
        currentUserId={currentUserId}
        viewerZone="Europe/Kyiv"
        startRow={1}
        span={2}
        dataGridCell="0-0"
        onClick={handleClick}
      />,
    );

    const wrapper = container.querySelector('[data-grid-cell="0-0"]') as HTMLElement;
    expect(wrapper.getAttribute('role')).toBe('gridcell');

    // WeekGridShell's keyboard handler calls native .click() on the
    // [data-grid-cell] element itself, not on any descendant.
    wrapper.click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders someone else's booking as a non-interactive div with first name in meta", () => {
    const currentUserId = 'u9999999-9999-9999-9999-999999999999';

    render(
      <BookingBlock
        booking={mockBooking}
        currentUserId={currentUserId}
        viewerZone="Europe/Kyiv"
        startRow={2}
        span={1}
      />,
    );

    expect(screen.queryByRole('button')).toBeNull();

    const titleEl = screen.getByText('Планування спринту');
    expect(titleEl).toBeTruthy();
    expect(titleEl.className).toContain('line-clamp-1');
    expect(titleEl.className).toContain('text-[12px]');

    const metaEl = screen.getByText('Тарас · 13:00–14:00');
    expect(metaEl).toBeTruthy();

    const card = titleEl.closest('div.rounded-\\[9px\\]');
    expect(card?.className).toContain('border-l-[4px]');
    expect(card?.className).toContain('border-l-secondary');
    expect(card?.className).toContain('bg-secondary-container');
    expect(card?.className).toContain('text-on-secondary-container');
    expect(card?.className).toContain('px-[8px] py-[4px]');
  });

  it('renders a free slot when no booking is provided', () => {
    const { container } = render(
      <BookingBlock viewerZone="Europe/Kyiv" startRow={5} span={1} />,
    );

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('+')).toBeTruthy();

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.gridRow).toBe('5 / span 1');
  });

  it('renders selected slot styling when isSelected is true and no booking is provided', () => {
    const { container } = render(
      <BookingBlock isSelected={true} viewerZone="Europe/Kyiv" startRow={5} span={1} />,
    );

    expect(screen.queryByRole('button')).toBeNull();
    const label = screen.getByText('Обраний слот');
    expect(label).toBeTruthy();
    expect(label.className).toContain('text-primary');

    const innerDiv = label.parentElement;
    expect(innerDiv?.className).toContain('border-2');
    expect(innerDiv?.className).toContain('border-dashed');
    expect(innerDiv?.className).toContain('border-primary');
    expect(innerDiv?.className).toContain('bg-[var(--glass-selected-slot)]');

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.gridRow).toBe('5 / span 1');
  });

  it('applies gridRow style to the outer wrapper and span 4 clamp', () => {
    const { container } = render(
      <BookingBlock
        booking={mockBooking}
        currentUserId={mockBooking.userId}
        viewerZone="Europe/Kyiv"
        startRow={4}
        span={4}
      />,
    );

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.gridRow).toBe('4 / span 4');

    const titleEl = screen.getByText('Планування спринту');
    expect(titleEl.className).toContain('line-clamp-4');
    expect(titleEl.className).toContain('text-[13px]');
  });

  it('formats booking times in the viewer zone, not browser-local', () => {
    // 10:00Z/11:00Z is 13:00–14:00 in Kyiv (UTC+3) but 19:00–20:00 in Tokyo (UTC+9).
    render(
      <BookingBlock
        booking={mockBooking}
        currentUserId={mockBooking.userId}
        viewerZone="Asia/Tokyo"
        startRow={1}
        span={2}
      />,
    );

    expect(screen.getByText('Ви · 19:00–20:00')).toBeTruthy();
  });

  it('renders correctly when isMobile is true', () => {
    const { container } = render(
      <BookingBlock
        booking={mockBooking}
        currentUserId={mockBooking.userId}
        viewerZone="Europe/Kyiv"
        isMobile={true}
        startRow={1}
        span={2}
      />,
    );

    const button = screen.getByRole('button');
    expect(button.className).toContain('rounded-[10px]');
    expect(button.className).toContain('px-[12px] py-[9px]');
    expect(screen.getByText('Планування спринту').className).toContain('text-[14px]');

    const freeSlotRender = render(
      <BookingBlock isMobile={true} viewerZone="Europe/Kyiv" startRow={3} span={1} />,
    );
    expect(freeSlotRender.getByText('+')).toBeTruthy();
    const freeSlotContainer = freeSlotRender.container.firstElementChild as HTMLElement;
    expect(freeSlotContainer.className).toContain('rounded-full');
    expect(freeSlotRender.getByText('+').parentElement?.className).toContain('border-[1.5px]');
  });
});
