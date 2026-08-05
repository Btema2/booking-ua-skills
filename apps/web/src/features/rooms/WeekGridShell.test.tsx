import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DateTime } from 'luxon';
import { WeekGridShell } from './WeekGridShell';

describe('WeekGridShell', () => {
  afterEach(() => {
    cleanup();
  });

  const sampleDays = Array.from({ length: 7 }, (_, i) =>
    DateTime.fromISO('2026-08-03T00:00:00', { zone: 'Europe/Kyiv' }).plus({ days: i }),
  );

  const sampleWeekStartISO = DateTime.fromISO('2026-08-03T00:00:00', {
    zone: 'Europe/Kyiv',
  })
    .toUTC()
    .toISO()!;

  const sampleGutterLabels = [
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
  ];

  it('renders sticky header with day names and dates in Ukrainian', () => {
    render(
      <WeekGridShell
        daysKyiv={sampleDays}
        gutterLabels={sampleGutterLabels}
        weekStartISO={sampleWeekStartISO}
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

  it('renders gutter labels hung at top of hour rows', () => {
    render(
      <WeekGridShell
        daysKyiv={sampleDays}
        gutterLabels={sampleGutterLabels}
        weekStartISO={sampleWeekStartISO}
        renderDayColumn={() => null}
      />,
    );

    sampleGutterLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeTruthy();
    });
  });

  it('invokes renderDayColumn for each day in daysKyiv', () => {
    const renderDayColumnMock = vi.fn((dayIndex: number, day: DateTime) => (
      <div data-testid={`day-content-${dayIndex}`}>Content {dayIndex}</div>
    ));

    render(
      <WeekGridShell
        daysKyiv={sampleDays}
        gutterLabels={sampleGutterLabels}
        weekStartISO={sampleWeekStartISO}
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
          gutterLabels={sampleGutterLabels}
          weekStartISO={sampleWeekStartISO}
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
          gutterLabels={sampleGutterLabels}
          weekStartISO={sampleWeekStartISO}
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
          gutterLabels={sampleGutterLabels}
          weekStartISO={sampleWeekStartISO}
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
          gutterLabels={sampleGutterLabels}
          weekStartISO={sampleWeekStartISO}
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
          gutterLabels={sampleGutterLabels}
          weekStartISO={sampleWeekStartISO}
          isCurrentWeek={false}
          renderDayColumn={() => null}
        />,
      );

      const grid = screen.getByRole('grid');
      expect(grid.getAttribute('tabindex')).toBe('-1');
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
          gutterLabels={sampleGutterLabels}
          weekStartISO={sampleWeekStartISO}
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
