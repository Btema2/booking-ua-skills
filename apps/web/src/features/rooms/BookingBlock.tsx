import type { Booking } from '@booking/core';

export interface BookingBlockProps {
  booking?: Booking | null;
  currentUserId?: string | null;
  startRow: number;
  span: number;
  onClick?: () => void;
}

function formatTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) {
    return '';
  }
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatTimeRange(startsAt: Date | string, endsAt: Date | string): string {
  const start = formatTime(startsAt);
  const end = formatTime(endsAt);
  return `${start}–${end}`;
}

function getFirstName(userName: string): string {
  if (!userName) return '';
  const parts = userName.trim().split(/\s+/);
  return parts[0] || '';
}

export function BookingBlock({
  booking,
  currentUserId,
  startRow,
  span,
  onClick,
}: BookingBlockProps) {
  const gridRowStyle = { gridRow: `${startRow} / span ${span}` };
  const padClass = span >= 2 ? 'px-[9px] py-[7px]' : 'px-[8px] py-[4px]';

  // 3. Free slot (when rendering an unoccupied slot on desktop)
  if (!booking) {
    return (
      <div style={gridRowStyle} className="py-[1.5px] px-[3px] min-h-0 min-w-0">
        <div className="group w-full h-full flex items-center justify-center rounded-[7px] hover:bg-primary-container transition-colors duration-[var(--dur-fast)]">
          <span className="opacity-0 group-hover:opacity-100 text-on-primary-container font-bold select-none">
            +
          </span>
        </div>
      </div>
    );
  }

  const isOwn = Boolean(currentUserId && booking.userId === currentUserId);
  const timeRange = formatTimeRange(booking.startsAt, booking.endsAt);

  const titleSizeClass = span >= 2 ? 'text-[13px]' : 'text-[12px]';
  const titleClampClass =
    span === 1 ? 'line-clamp-1' : span <= 3 ? 'line-clamp-2' : 'line-clamp-4';

  if (isOwn) {
    // 1. My booking
    return (
      <div style={gridRowStyle} className="py-[1.5px] px-[3px] min-h-0 min-w-0">
        <button
          type="button"
          onClick={onClick}
          className={`w-full h-full flex flex-col justify-start text-left overflow-hidden box-border rounded-[9px] border-2 border-primary bg-primary-container text-on-primary-container hover:shadow-[var(--shadow-el-2)] transition-shadow duration-[var(--dur-block)] cursor-pointer ${padClass}`}
        >
          <div className="flex items-center gap-[5px] min-w-0 uppercase tracking-[0.04em] font-bold text-[11px] text-on-primary-container">
            <span className="w-[7px] h-[7px] rounded-full bg-primary shrink-0" aria-hidden="true" />
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
    <div style={gridRowStyle} className="py-[1.5px] px-[3px] min-h-0 min-w-0">
      <div
        className={`w-full h-full flex flex-col justify-start text-left overflow-hidden box-border rounded-[9px] border border-outline-variant border-l-[4px] border-l-secondary bg-secondary-container text-on-secondary-container ${padClass}`}
      >
        <div className="flex items-center gap-[5px] min-w-0 tracking-[0.02em] font-bold text-[11px] text-on-secondary-container">
          <svg
            viewBox="0 0 24 24"
            width="10"
            height="10"
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
