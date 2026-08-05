import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DateTime } from 'luxon';
import { WeekGridShell } from './WeekGridShell';
import { getHourLabelsForGutter, getViewerZone } from './timeUtils';

describe('WeekGridShell', () => {
  afterEach(() => {
    cleanup();
  });

  const sampleDays = Array.from({ length: 7 }, (_, i) =>
    DateTime.fromISO('2026-08-03T00:00:00', { zone: 'Europe/Kyiv' }).plus({ days: i }),
  );

  it('renders sticky header with day names and dates in Ukrainian', () => {
    render(
      <WeekGridShell
        daysKyiv={sampleDays}
        renderDayColumn={(index) => <div data-testid={`col-${index}`}>Day {index}</div>}
      />,
    );

    expect(screen.getByText('ПН')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('ВТ')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('СР')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('renders gutter labels hung at top of hour rows in every day column', () => {
    render(
      <WeekGridShell
        daysKyiv={sampleDays}
        renderDayColumn={() => null}
      />,
    );

    const expectedLabels = getHourLabelsForGutter(sampleDays[0], getViewerZone());
    expectedLabels.forEach((label) => {
      // Each label repeats once per day column (7 columns), one per hour row.
      expect(screen.getAllByText(label).length).toBe(7);
    });
  });

  it('invokes renderDayColumn for each day in daysKyiv', () => {
    const renderDayColumnMock = vi.fn((dayIndex: number, day: DateTime) => (
      <div data-testid={`day-content-${dayIndex}`}>Content {dayIndex}</div>
    ));

    render(
      <WeekGridShell
        daysKyiv={sampleDays}
        renderDayColumn={renderDayColumnMock}
      />,
    );

    expect(renderDayColumnMock.mock.calls.length).toBeGreaterThanOrEqual(7);
    sampleDays.forEach((day, index) => {
      expect(screen.getByTestId(`day-content-${index}`)).toBeTruthy();
    });
  });

  describe('Now indicator line', () => {
    it('appears only in today column and only when current week is displayed with frozen clock', () => {
      // Frozen clock at 12:00 UTC (15:00 Kyiv) on Wednesday 5 Aug 2026
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-05T12:00:00Z'));

      const { container, rerender } = render(
        <WeekGridShell
          daysKyiv={sampleDays}
            isCurrentWeek={true}
          renderDayColumn={() => null}
        />,
      );

      // Now line dot should be present in the container
      const nowLineDot = container.querySelector('.bg-error');
      expect(nowLineDot).not.toBeNull();

      // Rerender with isCurrentWeek={false}
      rerender(
        <WeekGridShell
          daysKyiv={sampleDays}
            isCurrentWeek={false}
          renderDayColumn={() => null}
        />,
      );

      expect(container.querySelector('.bg-error')).toBeNull();
      vi.useRealTimers();
    });
  });

  describe('Roving tabindex & ARIA navigation', () => {
    it('has exactly one cell with tabindex="0", handles ArrowRight and ArrowDown, and skips past cells', () => {
      const { container } = render(
        <WeekGridShell
          daysKyiv={sampleDays}
            isCurrentWeek={true}
          renderDayColumn={(dayIndex, _day, pastRowsCount, focusedCoords) => (
            <>
              {Array.from({ length: 20 }, (_, r) => {
                const isFocused =
                  focusedCoords.dayIndex === dayIndex && focusedCoords.rowIndex === r;
                return (
                  <div
                    key={r}
                    role="gridcell"
                    tabIndex={isFocused ? 0 : -1}
                    data-grid-cell={`${dayIndex}-${r}`}
                  >
                    Cell {dayIndex}-{r}
                  </div>
                );
              })}
            </>
          )}
        />,
      );

      const focusableCells = container.querySelectorAll('[tabindex="0"]');
      expect(focusableCells.length).toBe(1);

      const grid = screen.getByRole('grid');
      expect(grid).toBeTruthy();
    });
  });

  describe('Roving tabindex on an all-past week', () => {
    it('falls back to making the grid root the tab stop when no day has a focusable slot', () => {
      const allPastDays = Array.from({ length: 7 }, (_, i) =>
        DateTime.fromISO('2020-01-06T00:00:00', { zone: 'Europe/Kyiv' }).plus({ days: i }),
      );

      render(
        <WeekGridShell
          daysKyiv={allPastDays}
            isCurrentWeek={false}
          renderDayColumn={() => null}
        />,
      );

      // No renderDayColumn cells exist at all here (mirrors RoomSchedulePage
      // rendering nothing for a fully-past, booking-less week), so the only
      // possible tab stop is the grid root itself.
      const grid = screen.getByRole('grid');
      expect(grid.getAttribute('tabindex')).toBe('0');
    });

    it('leaves the grid root out of the tab order when a normal focusable slot exists', () => {
      render(
        <WeekGridShell
          daysKyiv={sampleDays}
            isCurrentWeek={false}
          renderDayColumn={() => null}
        />,
      );

      const grid = screen.getByRole('grid');
      expect(grid.getAttribute('tabindex')).toBe('-1');
    });
  });

  describe('Enter/Space activation inside multi-row bookings', () => {
    // A week sufficiently far ahead so no row is treated as past, keeping the
    // initial focusedCoords on day 0.
    const futureDays = Array.from({ length: 7 }, (_, i) =>
      DateTime.fromISO('2026-09-14T00:00:00', { zone: 'Europe/Kyiv' }).plus({ days: i }),
    );

    // Reproduces the real DOM from RoomSchedulePage: free cells for rows 0..3
    // are emitted first (ascending), then a span=2 booking anchored at `0-4`
    // (covers rows 4..5). The booking gridcell only carries its start-slot
    // attribute (`0-4`), never a marker for its interior rows.
    const renderDayWithSpanBooking = (
      onFreeClick: (row: number) => void,
      onBookingClick: () => void,
    ) =>
      (dayIndex: number, _day: DateTime, _pastRowsCount: number, focusedCoords: { dayIndex: number; rowIndex: number }) => {
        if (dayIndex !== 0) return null;
        return (
          <>
            {[0, 1, 2, 3].map((r) => (
              <button
                key={r}
                type="button"
                role="gridcell"
                data-grid-cell={`0-${r}`}
                tabIndex={
                  focusedCoords.dayIndex === 0 && focusedCoords.rowIndex === r ? 0 : -1
                }
                onClick={() => onFreeClick(r)}
              >
                Free {r}
              </button>
            ))}
            <button
              type="button"
              role="gridcell"
              data-grid-cell="0-4"
              tabIndex={
                focusedCoords.dayIndex === 0 &&
                focusedCoords.rowIndex >= 4 &&
                focusedCoords.rowIndex < 6
                  ? 0
                  : -1
              }
              onClick={onBookingClick}
            >
              Booking 0-4
            </button>
          </>
        );
      };

    const moveFocusToInteriorRow = (grid: HTMLElement) => {
      // From initial row 0, ArrowDown five times to land on row 5, which is
      // inside the booking's span but not its start row.
      for (let i = 0; i < 5; i += 1) {
        fireEvent.keyDown(grid, { key: 'ArrowDown' });
      }
    };

    it('Enter on an interior span row activates the booking, not the first free cell', () => {
      const onFreeClick = vi.fn();
      const onBookingClick = vi.fn();

      render(
        <WeekGridShell
          daysKyiv={futureDays}
          gutterLabels={sampleGutterLabels}
          isCurrentWeek={false}
          renderDayColumn={renderDayWithSpanBooking(onFreeClick, onBookingClick)}
        />,
      );

      const grid = screen.getByRole('grid');
      moveFocusToInteriorRow(grid);
      fireEvent.keyDown(grid, { key: 'Enter' });

      expect(onBookingClick).toHaveBeenCalledTimes(1);
      expect(onFreeClick).not.toHaveBeenCalled();
    });

    it('Space on an interior span row activates the booking, not the first free cell', () => {
      const onFreeClick = vi.fn();
      const onBookingClick = vi.fn();

      render(
        <WeekGridShell
          daysKyiv={futureDays}
          gutterLabels={sampleGutterLabels}
          isCurrentWeek={false}
          renderDayColumn={renderDayWithSpanBooking(onFreeClick, onBookingClick)}
        />,
      );

      const grid = screen.getByRole('grid');
      moveFocusToInteriorRow(grid);
      fireEvent.keyDown(grid, { key: ' ' });

      expect(onBookingClick).toHaveBeenCalledTimes(1);
      expect(onFreeClick).not.toHaveBeenCalled();
    });

    it('Enter on an exact free row still activates that cell, not a lower one', () => {
      const onFreeClick = vi.fn();
      const onBookingClick = vi.fn();

      render(
        <WeekGridShell
          daysKyiv={futureDays}
          gutterLabels={sampleGutterLabels}
          isCurrentWeek={false}
          renderDayColumn={renderDayWithSpanBooking(onFreeClick, onBookingClick)}
        />,
      );

      const grid = screen.getByRole('grid');
      // Row 2 is an exact free cell, not inside a booking span.
      for (let i = 0; i < 2; i += 1) {
        fireEvent.keyDown(grid, { key: 'ArrowDown' });
      }
      fireEvent.keyDown(grid, { key: 'Enter' });

      expect(onFreeClick).toHaveBeenCalledWith(2);
      expect(onBookingClick).not.toHaveBeenCalled();
    });
  });

  describe('Weekend parity', () => {
    it('asserts a Saturday cell and a Monday cell in the same future week have identical state', () => {
      const futureDays = Array.from({ length: 7 }, (_, i) =>
        DateTime.fromISO('2026-09-14T00:00:00', { zone: 'Europe/Kyiv' }).plus({ days: i }),
      );

      const { container } = render(
        <WeekGridShell
          daysKyiv={futureDays}
            isCurrentWeek={false}
          renderDayColumn={(dayIndex, _day, pastRowsCount, focusedCoords) => (
            <button
              type="button"
              data-testid={`cell-day-${dayIndex}`}
              tabIndex={focusedCoords.dayIndex === dayIndex ? 0 : -1}
            >
              Slot
            </button>
          )}
        />,
      );

      const mondayCell = screen.getByTestId('cell-day-0') as HTMLButtonElement; // Monday
      const saturdayCell = screen.getByTestId('cell-day-5') as HTMLButtonElement; // Saturday

      expect(mondayCell.disabled).toBe(false);
      expect(saturdayCell.disabled).toBe(false);

      const mondayCol = mondayCell.closest('.grid');
      const saturdayCol = saturdayCell.closest('.grid');

      expect(mondayCol?.className).toContain('bg-surface-container-lowest');
      expect(saturdayCol?.className).toContain('bg-surface-container-lowest');
    });
  });
});
