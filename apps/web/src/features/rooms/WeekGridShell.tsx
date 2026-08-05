import type { DateTime } from 'luxon';
import React from 'react';

export interface WeekGridShellProps {
  readonly daysKyiv: DateTime[];
  readonly gutterLabels: string[];
  readonly renderDayColumn: (dayIndex: number, day: DateTime) => React.ReactNode;
}

/**
 * Formats a Luxon DateTime to Ukrainian day name and date (e.g. "Пн 05.08").
 */
function formatUkrainianDayHeader(day: DateTime): string {
  if (!day || typeof day.setLocale !== 'function') {
    return '';
  }
  const formatted = day.setLocale('uk').toFormat('ccc dd.MM');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * WeekGridShell - Task B grid shell component for the week schedule grid (DESIGN-NOTES.md §1).
 *
 * Provides sticky header, 20-row time-gutter, half-hour & hour rule lines,
 * and fluid day columns frame.
 */
export function WeekGridShell({
  daysKyiv,
  gutterLabels,
  renderDayColumn,
}: WeekGridShellProps) {
  return (
    <div className="overflow-clip rounded-[var(--radius-lg)] border border-outline-variant bg-surface-container-lowest">
      {/* Sticky Day Header Row */}
      <div
        className="sticky top-[var(--grid-head-sticky-top)] z-[var(--z-gridhead)] grid h-[var(--grid-head-h)] grid-cols-[var(--grid-columns)] border-b border-outline-variant bg-[var(--glass-gridhead-fallback)] supports-[backdrop-filter]:bg-[var(--glass-gridhead)] supports-[backdrop-filter]:backdrop-blur-[var(--blur-gridhead)] supports-[backdrop-filter]:backdrop-saturate-[var(--glass-gridhead-saturate)]"
        style={{ gridTemplateColumns: 'var(--grid-columns)' }}
      >
        {/* Empty time gutter header cell */}
        <div className="border-r border-outline-variant" />

        {/* 7 Day column headers */}
        {daysKyiv.map((day, dayIndex) => {
          const dow = day?.setLocale('uk').toFormat('ccc').toUpperCase() ?? '';
          const dayNum = day?.day ?? '';
          return (
            <div
              key={day.toISO() ?? dayIndex}
              className="flex flex-col items-center justify-center border-r border-outline-variant text-center last:border-r-0"
            >
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant leading-none">
                {dow}
              </span>
              <span className="mt-[3px] font-heading font-display text-[20px] leading-none text-on-surface">
                {dayNum}
              </span>
            </div>
          );
        })}
      </div>

      {/* Grid Frame Body */}
      <div
        className="grid grid-cols-[var(--grid-columns)]"
        style={{ gridTemplateColumns: 'var(--grid-columns)' }}
      >
        {/* Time Gutter Column */}
        <div
          className="grid grid-rows-[repeat(20,var(--slot-h))] border-r border-outline-variant bg-surface-container-lowest"
          style={{ gridTemplateRows: 'repeat(20, var(--slot-h))' }}
        >
          {Array.from({ length: 20 }, (_, rowIndex) => {
            const isHourRow = rowIndex % 2 === 0;
            const labelIndex = Math.floor(rowIndex / 2);
            const label = isHourRow ? gutterLabels[labelIndex] : undefined;

            return (
              <div
                key={rowIndex}
                className={
                  isHourRow
                    ? 'border-t border-outline-variant'
                    : 'border-t border-[var(--color-rule-half-hour)]'
                }
              >
                {isHourRow && label !== undefined ? (
                  <div className="text-[11.5px] font-bold tabular-nums pr-[10px] pt-[2px] text-right text-on-surface-variant">
                    {label}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Day Columns */}
        {daysKyiv.map((day, dayIndex) => (
          <div
            key={day.toISO() ?? dayIndex}
            className="relative grid grid-rows-[repeat(20,var(--slot-h))] border-r border-outline-variant last:border-r-0"
            style={{ gridTemplateRows: 'repeat(20, var(--slot-h))' }}
          >
            {/* Background Hour & Half-Hour Rule Lines */}
            <div
              className="pointer-events-none absolute inset-0 grid grid-rows-[repeat(20,var(--slot-h))]"
              style={{ gridTemplateRows: 'repeat(20, var(--slot-h))' }}
              aria-hidden="true"
            >
              {Array.from({ length: 20 }, (_, rowIndex) => {
                const isHourRow = rowIndex % 2 === 0;
                return (
                  <div
                    key={rowIndex}
                    className={
                      isHourRow
                        ? 'border-t border-outline-variant'
                        : 'border-t border-[var(--color-rule-half-hour)]'
                    }
                  />
                );
              })}
            </div>

            {/* Day Column Content Rendered via prop */}
            {renderDayColumn(dayIndex, day)}
          </div>
        ))}
      </div>
    </div>
  );
}
