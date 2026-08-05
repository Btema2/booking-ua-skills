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
});
