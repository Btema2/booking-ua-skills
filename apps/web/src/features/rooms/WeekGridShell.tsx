import { DateTime } from 'luxon';
import React, { useState, useEffect, useRef } from 'react';
import {
  getDayColumnStatus,
  getPastRowsCount,
  getNowLineInfo,
  getViewerZone,
  getHourLabelsForGutter,
} from './timeUtils';

export interface WeekGridShellProps {
  readonly daysKyiv: DateTime[];
  readonly weekStartISO: string;
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
  weekStartISO,
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
  }, [weekStartISO]);

  // Latest focusedCoords, readable from the now-driven effect below without
  // putting focusedCoords itself in that effect's dependency array (which
  // would re-run it on every arrow-key-driven focus move too, not just when
  // the ticker advances `now`).
  const focusedCoordsRef = useRef(focusedCoords);
  useEffect(() => {
    focusedCoordsRef.current = focusedCoords;
  }, [focusedCoords]);

  // The 30s ticker above can age the row `focusedCoords` points to into the
  // past. RoomSchedulePage never renders a free-slot cell for a past row, so
  // once that exact cell stops existing — while some other row elsewhere in
  // the week is still non-past, keeping hasFocusableCell (and therefore the
  // grid root's own tabIndex) unchanged — zero elements in the grid carry
  // tabIndex=0 and the grid becomes unreachable by Tab. Re-derive
  // focusedCoords only when the cell it currently points to has itself
  // become past; do nothing otherwise, so a tick never clobbers in-progress
  // arrow-key navigation.
  useEffect(() => {
    const current = focusedCoordsRef.current;
    const focusedDay = daysKyiv[current.dayIndex];
    const focusedCellIsPast = focusedDay
      ? getPastRowsCount(focusedDay, now) > current.rowIndex
      : false;
    if (focusedCellIsPast) {
      setFocusedCoords(getInitialFocusedCoords(daysKyiv, now));
    }
  }, [now]);

  // A week entirely in the past has no free slot left to land tabIndex=0 on
  // (RoomSchedulePage never renders a free-slot cell for a past row). Fall
  // back to making the grid root itself the single tab stop so keyboard
  // users still have somewhere to land.
  const hasFocusableCell = daysKyiv.some((day) => getPastRowsCount(day, now) < 20);

  // The grid has one shared 76px gutter column (DESIGN-NOTES.md §1), not one
  // per day. getHourLabelsForGutter is per-day for DST correctness (a
  // transition can fall mid-week), but the single visible gutter can only
  // show one set of labels — Monday's, matching the reference used before
  // the per-day DST fix. Booking positions and times remain per-instant
  // correct regardless (getBookingGridRow, formatInstantTime), so this only
  // affects the gutter's own hour text, and only in the rare week a DST
  // transition falls between Monday and the currently-viewed day.
  const gutterHourLabels = getHourLabelsForGutter(daysKyiv[0], viewerZone);

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
        // A multi-row booking renders a single gridcell carrying only its
        // start-slot value (data-grid-cell="day-startSlot"). Interior rows of
        // that booking have no gridcell of their own, so when focus lands there
        // the exact "day-row" lookup fails. Pick the same-day gridcell whose row
        // (parsed from its data attribute) is the greatest one <= focusedRow —
        // that is the booking's start cell (or the exact cell for a free slot).
        const cells = document.querySelectorAll<HTMLElement>(
          `[data-grid-cell^="${dayIndex}-"]`,
        );
        let gridTarget: HTMLElement | null = null;
        let bestRow = -1;
        for (const cell of cells) {
          const cellRow = Number(cell.dataset.gridCell?.split('-')[1]);
          if (Number.isFinite(cellRow) && cellRow <= rowIndex && cellRow > bestRow) {
            gridTarget = cell;
            bestRow = cellRow;
          }
        }
        if (gridTarget) {
          gridTarget.click();
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
        {/* Shared Time Gutter — one column, labels hung at the top of each hour row */}
        <div
          className="grid grid-rows-[repeat(20,var(--slot-h))] border-r border-outline-variant bg-surface-container-lowest"
          style={{ gridColumn: 1, gridTemplateRows: 'repeat(20, var(--slot-h))' }}
          aria-hidden="true"
        >
          {Array.from({ length: 20 }, (_, rowIndex) => {
            const isHourRow = rowIndex % 2 === 0;
            const label = isHourRow ? gutterHourLabels[Math.floor(rowIndex / 2)] : undefined;
            return (
              <div
                key={rowIndex}
                className={`flex items-start justify-end pr-[6px] pt-[2px] ${
                  isHourRow ? 'border-t border-outline-variant' : 'border-t border-[var(--color-rule-half-hour)]'
                }`}
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

        {/* Day Columns */}
        {daysKyiv.map((day, dayIndex) => {
          const { isToday, isPastDay } = getDayColumnStatus(day, now);
          const pastRowsCount = getPastRowsCount(day, now);
          const nowLine = getNowLineInfo(day, isCurrentWeek, now);

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
