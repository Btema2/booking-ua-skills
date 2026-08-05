import { DateTime } from 'luxon';
import React, { useState, useEffect } from 'react';
import {
  getDayColumnStatus,
  getPastRowsCount,
  getNowLineInfo,
  getViewerZone,
  getHourLabelsForGutter,
} from './timeUtils';

export interface WeekGridShellProps {
  readonly daysKyiv: DateTime[];
  readonly isCurrentWeek?: boolean;
  readonly renderDayColumn: (
    dayIndex: number,
    day: DateTime,
    pastRowsCount: number,
    focusedCoords: { dayIndex: number; rowIndex: number },
    onCellFocus: (dayIndex: number, rowIndex: number) => void,
  ) => React.ReactNode;
}

const getInitialFocusedCoords = (days: DateTime[], nowTime: DateTime) => {
  for (let d = 0; d < days.length; d++) {
    const pastCount = getPastRowsCount(days[d], nowTime);
    if (pastCount < 20) {
      return { dayIndex: d, rowIndex: pastCount };
    }
  }
  return { dayIndex: 0, rowIndex: 0 };
};

/**
 * WeekGridShell - Grid shell component for the week schedule grid (DESIGN-NOTES.md §1).
 *
 * Provides sticky header, 20-row time-gutter, half-hour & hour rule lines,
 * column tints, merged past hatching, now indicator line, fluid day columns frame,
 * and ARIA grid keyboard navigation (roving tabindex).
 */
export function WeekGridShell({
  daysKyiv,
  isCurrentWeek = false,
  renderDayColumn,
}: WeekGridShellProps) {
  const viewerZone = getViewerZone();
  const [now, setNow] = useState(() => DateTime.now().setZone('Europe/Kyiv'));
  const [focusedCoords, setFocusedCoords] = useState(() =>
    getInitialFocusedCoords(daysKyiv, DateTime.now().setZone('Europe/Kyiv')),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(DateTime.now().setZone('Europe/Kyiv'));
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setFocusedCoords(getInitialFocusedCoords(daysKyiv, now));
  }, [daysKyiv]);

  // A week entirely in the past has no free slot left to land tabIndex=0 on
  // (RoomSchedulePage never renders a free-slot cell for a past row). Fall
  // back to making the grid root itself the single tab stop so keyboard
  // users still have somewhere to land.
  const hasFocusableCell = daysKyiv.some((day) => getPastRowsCount(day, now) < 20);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      const { dayIndex, rowIndex } = focusedCoords;
      let nextDay = dayIndex;
      let nextRow = rowIndex;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        for (let d = dayIndex + 1; d < 7; d++) {
          const pastCount = getPastRowsCount(daysKyiv[d], now);
          if (pastCount < 20) {
            nextDay = d;
            nextRow = Math.max(rowIndex, pastCount);
            break;
          }
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        for (let d = dayIndex - 1; d >= 0; d--) {
          const pastCount = getPastRowsCount(daysKyiv[d], now);
          if (pastCount < 20) {
            nextDay = d;
            nextRow = Math.max(rowIndex, pastCount);
            break;
          }
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (rowIndex + 1 < 20) {
          nextRow = rowIndex + 1;
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const pastCount = getPastRowsCount(daysKyiv[dayIndex], now);
        if (rowIndex - 1 >= pastCount) {
          nextRow = rowIndex - 1;
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const activeEl = document.querySelector<HTMLElement>(
          `[data-grid-cell="${dayIndex}-${rowIndex}"]`,
        );
        if (activeEl) {
          activeEl.click();
        }
        return;
      }

      if (nextDay !== dayIndex || nextRow !== rowIndex) {
        setFocusedCoords({ dayIndex: nextDay, rowIndex: nextRow });
        setTimeout(() => {
          const cellEl = document.querySelector<HTMLElement>(
            `[data-grid-cell="${nextDay}-${nextRow}"]`,
          );
          if (cellEl) {
            cellEl.focus();
          }
        }, 0);
      }
    }
  };

  return (
    <div
      role="grid"
      aria-label="Розклад переговорної"
      tabIndex={hasFocusableCell ? -1 : 0}
      onKeyDown={handleKeyDown}
      className="overflow-clip rounded-[var(--radius-lg)] border border-outline-variant bg-surface-container-lowest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container"
    >
      {/* Sticky Day Header Row */}
      <div
        role="row"
        className="sticky top-[var(--grid-head-sticky-top)] z-[var(--z-gridhead)] grid h-[var(--grid-head-h)] grid-cols-[var(--grid-columns)] border-b border-outline-variant bg-[var(--glass-gridhead-fallback)] supports-[backdrop-filter]:bg-[var(--glass-gridhead)] supports-[backdrop-filter]:backdrop-blur-[var(--blur-gridhead)] supports-[backdrop-filter]:backdrop-saturate-[var(--glass-gridhead-saturate)]"
        style={{ gridTemplateColumns: 'var(--grid-columns)' }}
      >
        {/* Empty time gutter header cell */}
        <div role="columnheader" aria-label="Час" className="border-r border-outline-variant" />

        {/* 7 Day column headers */}
        {daysKyiv.map((day, dayIndex) => {
          const dow = day?.setLocale('uk').toFormat('ccc').toUpperCase() ?? '';
          const dayNum = day?.day ?? '';
          const { isToday, isPastDay } = getDayColumnStatus(day, now);

          let headerClass =
            'flex flex-col items-center justify-center border-r border-outline-variant text-center last:border-r-0';
          if (isToday) {
            headerClass += ' bg-[var(--glass-today-head)]';
          }
          if (isPastDay) {
            headerClass += ' opacity-60';
          }

          return (
            <div role="columnheader" key={day.toISO() ?? dayIndex} className={headerClass}>
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
        {/* Day Columns */}
        {daysKyiv.map((day, dayIndex) => {
          const { isToday, isPastDay } = getDayColumnStatus(day, now);
          const pastRowsCount = getPastRowsCount(day, now);
          const nowLine = getNowLineInfo(day, isCurrentWeek, now);
          const hourLabels = getHourLabelsForGutter(day, viewerZone);

          let colBgClass = 'bg-surface-container-lowest';
          if (isToday) {
            colBgClass = 'bg-[var(--color-today-column)]';
          } else if (isPastDay) {
            colBgClass = 'bg-[var(--color-past-day)]';
          }

          return (
            <div
              key={day.toISO() ?? dayIndex}
              className={`relative grid grid-rows-[repeat(20,var(--slot-h))] border-r border-outline-variant last:border-r-0 ${colBgClass}`}
              style={{ gridColumn: dayIndex + 2, gridTemplateRows: 'repeat(20, var(--slot-h))' }}
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

              {/* Per-column gutter labels overlay */}
              <div
                className="pointer-events-none absolute inset-y-0 left-0 z-10 grid grid-rows-[repeat(20,var(--slot-h))]"
                style={{ gridTemplateRows: 'repeat(20, var(--slot-h))' }}
                aria-hidden="true"
              >
                {Array.from({ length: 20 }, (_, rowIndex) => {
                  const isHourRow = rowIndex % 2 === 0;
                  const label = isHourRow
                    ? hourLabels[Math.floor(rowIndex / 2)]
                    : undefined;
                  return (
                    <div
                      key={rowIndex}
                      className="flex items-start justify-end pr-[6px] pt-[2px]"
                    >
                      {label ? (
                        <span className="text-[11.5px] font-bold tabular-nums text-on-surface-variant">
                          {label}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Merged Past Hatching Block */}
              {pastRowsCount > 0 && (
                <div
                  className="pointer-events-none z-0 bg-[var(--color-past-day)] [background-image:var(--pattern-past)]"
                  style={{ gridRow: `1 / ${pastRowsCount + 1}` }}
                  aria-hidden="true"
                />
              )}

              {/* Now Indicator Line */}
              {nowLine.isVisible && (
                <div
                  className="pointer-events-none absolute left-0 right-0 z-20 h-[2px] bg-error"
                  style={{ top: `${nowLine.topPercentage}%` }}
                  aria-hidden="true"
                >
                  <div className="absolute -left-[5px] -top-[4px] size-[10px] rounded-full bg-error" />
                </div>
              )}

              {/* Day Column Content Rendered via prop */}
              {renderDayColumn(
                dayIndex,
                day,
                pastRowsCount,
                focusedCoords,
                (d, r) => setFocusedCoords({ dayIndex: d, rowIndex: r }),
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
