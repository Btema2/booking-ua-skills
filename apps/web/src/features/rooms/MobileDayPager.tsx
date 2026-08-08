import { DateTime } from 'luxon';
import type { ReactNode } from 'react';
import {
  getDayColumnStatus,
  getPastRowsCount,
  getNowLineInfo,
  getViewerZone,
  getHourLabelsForGutter,
} from './timeUtils';

export interface MobileDayPagerProps {
  readonly daysKyiv: DateTime[];
  readonly selectedDayIndex: number;
  readonly onSelectDayIndex: (index: number) => void;
  readonly isCurrentWeek?: boolean;
  readonly renderDayColumn: (
    dayIndex: number,
    day: DateTime,
    pastRowsCount: number,
    focusedCoords: { dayIndex: number; rowIndex: number },
    onCellFocus: (dayIndex: number, rowIndex: number) => void,
  ) => ReactNode;
}

export function MobileDayPager({
  daysKyiv,
  selectedDayIndex,
  onSelectDayIndex,
  isCurrentWeek = false,
  renderDayColumn,
}: MobileDayPagerProps) {
  const viewerZone = getViewerZone();
  const now = DateTime.now().setZone('Europe/Kyiv');

  const selectedDay = daysKyiv[selectedDayIndex] ?? daysKyiv[0];
  const gutterHourLabels = getHourLabelsForGutter(selectedDay, viewerZone);

  const { isToday, isPastDay } = getDayColumnStatus(selectedDay, now);
  const pastRowsCount = getPastRowsCount(selectedDay, now);
  const nowLine = getNowLineInfo(selectedDay, isCurrentWeek, now);

  let colBgClass = 'bg-surface-container-lowest';
  if (isToday) {
    colBgClass = 'bg-[var(--color-today-column)]';
  } else if (isPastDay) {
    colBgClass = 'bg-[var(--color-past-day)]';
  }

  return (
    <div className="flex flex-col gap-s3 w-full" data-testid="mobile-day-pager">
      {/* Day Pager Strip — 7 columns */}
      <div
        role="tablist"
        aria-label="Дні тижня"
        className="grid grid-cols-7 gap-[var(--pager-gap,5px)] w-full"
        style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
      >
        {daysKyiv.map((day, idx) => {
          const dow = day.setLocale('uk').toFormat('ccc').toUpperCase();
          const dayNum = day.day;
          const isActive = idx === selectedDayIndex;
          const { isToday: isDayToday } = getDayColumnStatus(day, now);

          let chipClass =
            'flex flex-col items-center justify-center min-h-[48px] px-[2px] pt-[8px] pb-[7px] rounded-[14px] transition-all duration-[var(--dur-fast)] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container';

          if (isActive) {
            chipClass += ' bg-primary text-on-primary font-bold shadow-sm';
          } else if (isDayToday) {
            chipClass += ' bg-[var(--glass-today-head-pager,#ffd0b4)] text-on-surface font-semibold hover:bg-primary-container';
          } else {
            chipClass += ' bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface';
          }

          return (
            <button
              key={day.toISO() ?? idx}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`${dow} ${dayNum}`}
              onClick={() => onSelectDayIndex(idx)}
              className={chipClass}
            >
              <span
                className={`text-[10px] font-bold uppercase tracking-[0.05em] leading-none ${
                  isActive ? 'text-on-primary' : 'text-on-surface-variant'
                }`}
              >
                {dow}
              </span>
              <span
                className={`mt-[3px] font-heading text-[17px] leading-[1.1] ${
                  isActive ? 'text-on-primary font-extrabold' : 'text-on-surface'
                }`}
              >
                {dayNum}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid Frame Container for Single Day */}
      <div
        role="grid"
        aria-label={`Розклад на ${selectedDay.setLocale('uk').toFormat('cccc, d MMMM')}`}
        className="overflow-y-auto max-h-[min(68vh,640px)] rounded-[var(--radius-lg)] border border-outline-variant bg-surface-container-lowest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container"
      >
        <div
          className="grid grid-cols-[52px_minmax(0,1fr)] relative"
          style={{ gridTemplateColumns: 'var(--grid-columns-mobile, 52px minmax(0,1fr))' }}
        >
          {/* Time Gutter Column */}
          <div
            data-testid="mobile-grid-gutter"
            className="grid grid-rows-[repeat(20,var(--slot-h-mobile,56px))] border-r border-outline-variant bg-surface-container-lowest"
            style={{ gridTemplateRows: 'repeat(20, var(--slot-h-mobile, 56px))' }}
            aria-hidden="true"
          >
            {Array.from({ length: 20 }, (_, rowIndex) => {
              const isHourRow = rowIndex % 2 === 0;
              const label = isHourRow ? gutterHourLabels[Math.floor(rowIndex / 2)] : undefined;
              return (
                <div
                  key={rowIndex}
                  className={`flex items-start justify-end pr-[8px] pt-[3px] ${
                    isHourRow
                      ? 'border-t border-outline-variant'
                      : 'border-t border-[var(--color-rule-half-hour)]'
                  }`}
                >
                  {label ? (
                    <span
                      data-testid="gutter-hour-label"
                      className="text-[11px] font-bold tabular-nums text-on-surface-variant"
                    >
                      {label}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Single Selected Day Column */}
          <div
            className={`relative grid grid-rows-[repeat(20,var(--slot-h-mobile,56px))] ${colBgClass}`}
            style={{ gridTemplateRows: 'repeat(20, var(--slot-h-mobile, 56px))' }}
          >
            {/* Background Hour & Half-Hour Rule Lines */}
            <div
              className="pointer-events-none absolute inset-0 grid grid-rows-[repeat(20,var(--slot-h-mobile,56px))]"
              style={{ gridTemplateRows: 'repeat(20, var(--slot-h-mobile, 56px))' }}
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
                className="pointer-events-none absolute inset-x-0 top-0 z-0 bg-[var(--color-past-day)] [background-image:var(--pattern-past)]"
                style={{ height: `calc(${pastRowsCount} * var(--slot-h-mobile, 56px))` }}
                aria-hidden="true"
              />
            )}

            {/* Now Indicator Line (left:52px right:0, 2px --color-error, 10px dot at left:-5px) */}
            {nowLine.isVisible && (
              <div
                className="pointer-events-none absolute left-0 right-0 z-20 h-[2px] bg-error"
                style={{ top: `${nowLine.topPercentage}%` }}
                aria-hidden="true"
              >
                <div className="absolute -left-[5px] -top-[4px] size-[10px] rounded-full bg-error" />
              </div>
            )}

            {/* Column Content */}
            {renderDayColumn(
              selectedDayIndex,
              selectedDay,
              pastRowsCount,
              { dayIndex: selectedDayIndex, rowIndex: 0 },
              () => {},
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
