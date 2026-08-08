import { DateTime } from 'luxon';
import type { Booking } from '@booking/core';

export interface BookingBlockProps {
  booking?: Booking | null;
  isSelected?: boolean;
  isMobile?: boolean;
  currentUserId?: string | null;
  viewerZone: string;
  startRow: number;
  span: number;
  tabIndex?: number;
  dataGridCell?: string;
  onFocus?: () => void;
  onClick?: () => void;
}

function toLuxonUtc(value: Date | string): DateTime {
  return typeof value === 'string'
    ? DateTime.fromISO(value, { zone: 'utc' })
    : DateTime.fromJSDate(value, { zone: 'utc' });
}

function formatTime(value: Date | string, viewerZone: string): string {
  const dt = toLuxonUtc(value);
  if (!dt.isValid) {
    return '';
  }
  return dt.setZone(viewerZone).toFormat('HH:mm');
}

function formatTimeRange(
  startsAt: Date | string,
  endsAt: Date | string,
  viewerZone: string,
): string {
  const start = formatTime(startsAt, viewerZone);
  const end = formatTime(endsAt, viewerZone);
  return `${start}–${end}`;
}

function getFirstName(userName: string): string {
  if (!userName) return '';
  const parts = userName.trim().split(/\s+/);
  return parts[0] || '';
}

export function BookingBlock({
  booking,
  isSelected,
  isMobile = false,
  currentUserId,
  viewerZone,
  startRow,
  span,
  tabIndex = -1,
  dataGridCell,
  onFocus,
  onClick,
}: BookingBlockProps) {
  const gridRowStyle = { gridRow: `${startRow} / span ${span}`, gridColumn: '1 / -1' };

  const cellPadClass = isMobile ? 'py-[3px] px-[8px]' : 'py-[1.5px] px-[3px]';
  const blockRadiusClass = isMobile ? 'rounded-[10px]' : 'rounded-[9px]';
  const padClass = isMobile
    ? span >= 2
      ? 'px-[12px] py-[9px]'
      : 'px-[11px] py-[7px]'
    : span >= 2
      ? 'px-[9px] py-[7px]'
      : 'px-[8px] py-[4px]';

  // 3. Free slot
  if (!booking) {
    if (isSelected) {
      return (
        <div
          role="gridcell"
          tabIndex={tabIndex}
          data-grid-cell={dataGridCell}
          onFocus={onFocus}
          onClick={onClick}
          style={gridRowStyle}
          className={`${cellPadClass} min-h-0 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${isMobile ? 'rounded-full' : 'rounded-[7px]'}`}
        >
          <div
            className={`w-full h-full flex items-center justify-center border-2 border-dashed border-primary bg-[var(--glass-selected-slot)] px-[4px] cursor-pointer ${
              isMobile ? 'rounded-full' : 'rounded-[7px]'
            }`}
          >
            <span className="text-primary font-bold text-[12px] select-none">
              Обраний слот
            </span>
          </div>
        </div>
      );
    }

    if (isMobile) {
      // Mobile free slot: transparent, pill radius 999px, 1.5px dashed outline-variant, always-visible +
      return (
        <div
          role="gridcell"
          tabIndex={tabIndex}
          data-grid-cell={dataGridCell}
          onFocus={onFocus}
          onClick={onClick}
          style={gridRowStyle}
          className={`${cellPadClass} min-h-0 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-full`}
        >
          <div className="w-full h-full flex items-center justify-center rounded-full border-[1.5px] border-dashed border-outline-variant bg-transparent active:bg-surface-container-high transition-colors duration-[var(--dur-fast)] cursor-pointer">
            <span className="text-on-surface-variant font-bold text-[14px] select-none">
              +
            </span>
          </div>
        </div>
      );
    }

    // Desktop free slot: transparent, radius 7px, hover reveals +
    return (
      <div
        role="gridcell"
        tabIndex={tabIndex}
        data-grid-cell={dataGridCell}
        onFocus={onFocus}
        onClick={onClick}
        style={gridRowStyle}
        className={`${cellPadClass} min-h-0 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-[7px]`}
      >
        <div className="group w-full h-full flex items-center justify-center rounded-[7px] hover:bg-primary-container transition-colors duration-[var(--dur-fast)] cursor-pointer">
          <span className="opacity-0 group-hover:opacity-100 text-on-primary-container font-bold select-none">
            +
          </span>
        </div>
      </div>
    );
  }

  const isOwn = Boolean(currentUserId && booking.userId === currentUserId);
  const timeRange = formatTimeRange(booking.startsAt, booking.endsAt, viewerZone);

  const titleSizeClass = isMobile
    ? span >= 2
      ? 'text-[14px]'
      : 'text-[13px]'
    : span >= 2
      ? 'text-[13px]'
      : 'text-[12px]';

  const titleClampClass =
    span === 1
      ? 'shrink-0 whitespace-nowrap overflow-hidden text-ellipsis'
      : span <= 3
        ? 'line-clamp-2'
        : 'line-clamp-4';

  const dotSizeClass = isMobile ? 'size-[8px]' : 'w-[7px] h-[7px]';
  const glyphSize = isMobile ? 11 : 10;
  const metaTrackingClass = isMobile ? 'tracking-[0.03em]' : 'tracking-[0.04em]';

  if (isOwn) {
    // 1. My booking
    return (
      <div
        role="gridcell"
        tabIndex={tabIndex}
        data-grid-cell={dataGridCell}
        onFocus={onFocus}
        onClick={onClick}
        style={gridRowStyle}
        className={`${cellPadClass} min-h-0 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${blockRadiusClass}`}
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          className={`w-full h-full flex flex-col justify-start text-left overflow-hidden box-border ${blockRadiusClass} border-2 border-primary bg-primary-container text-on-primary-container hover:shadow-[var(--shadow-el-2)] transition-shadow duration-[var(--dur-block)] cursor-pointer ${padClass}`}
        >
          <div className={`flex items-center gap-[5px] min-w-0 uppercase ${metaTrackingClass} font-bold text-[11px] text-on-primary-container`}>
            <span className={`${dotSizeClass} rounded-full bg-primary shrink-0`} aria-hidden="true" />
            <span className="whitespace-nowrap overflow-hidden text-ellipsis">
              Ви · {timeRange}
            </span>
          </div>
          <div className={`mt-[2px] font-semibold leading-[1.25] break-words ${titleSizeClass} ${titleClampClass}`}>
            {booking.title}
          </div>
        </button>
      </div>
    );
  }

  // 2. Someone else's booking
  const firstName = getFirstName(booking.userName);

  return (
    <div
      role="gridcell"
      tabIndex={tabIndex}
      data-grid-cell={dataGridCell}
      onFocus={onFocus}
      style={gridRowStyle}
      className={`${cellPadClass} min-h-0 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${blockRadiusClass}`}
    >
      <div
        className={`w-full h-full flex flex-col justify-start text-left overflow-hidden box-border ${blockRadiusClass} border border-outline-variant border-l-[4px] border-l-secondary bg-secondary-container text-on-secondary-container ${padClass}`}
      >
        <div className="flex items-center gap-[5px] min-w-0 tracking-[0.02em] font-bold text-[11px] text-on-secondary-container">
          <svg
            viewBox="0 0 24 24"
            width={glyphSize}
            height={glyphSize}
            stroke="var(--color-secondary)"
            strokeWidth="3"
            fill="none"
            className="shrink-0"
            aria-hidden="true"
          >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="whitespace-nowrap overflow-hidden text-ellipsis">
            {firstName} · {timeRange}
          </span>
        </div>
        <div className={`mt-[2px] font-semibold leading-[1.25] break-words ${titleSizeClass} ${titleClampClass}`}>
          {booking.title}
        </div>
      </div>
    </div>
  );
}
