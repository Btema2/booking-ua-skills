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
    const renderDayColumnMock = vi.fn((dayIndex: number) => (
      <div data-testid={`day-content-${dayIndex}`}>Content {dayIndex}</div>
    ));

    render(
      <WeekGridShell
        daysKyiv={sampleDays}
        gutterLabels={sampleGutterLabels}
        renderDayColumn={renderDayColumnMock}
      />,
    );

    expect(renderDayColumnMock).toHaveBeenCalledTimes(7);
    sampleDays.forEach((day, index) => {
      expect(renderDayColumnMock).toHaveBeenNthCalledWith(index + 1, index, day);
      expect(screen.getByTestId(`day-content-${index}`)).toBeTruthy();
    });
  });
});
