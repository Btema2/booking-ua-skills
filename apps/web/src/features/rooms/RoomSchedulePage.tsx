import { useParams, Link, useSearchParams } from 'react-router';
import { useRoomDetails, useRoomBookings } from './useRoomBookings';
import { useCurrentUser } from '../auth/useCurrentUser';
import {
  getKyivWeek,
  getPrevKyivWeekParam,
  getNextKyivWeekParam,
  getViewerZone,
  getHourLabelsForGutter,
  getBookingGridRow,
  formatKyivWeekRange,
  formatTzBannerText,
} from './timeUtils';
import { WeekGridShell } from './WeekGridShell';
import { BookingBlock } from './BookingBlock';
import { WeekGridLoading, WeekGridEmpty, WeekGridError } from './WeekGridStates';

export function RoomSchedulePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const validRoomId = roomId ?? '';
  const [searchParams, setSearchParams] = useSearchParams();
  const weekParam = searchParams.get('week');
  const weekInfo = getKyivWeek(weekParam);
  const { mondayKyiv, sundayEndKyiv, daysKyiv } = weekInfo;

  const roomQuery = useRoomDetails(validRoomId);
  const bookingsQuery = useRoomBookings(validRoomId, weekInfo);
  const currentUserQuery = useCurrentUser();

  const currentUserId = currentUserQuery.data?.id ?? null;
  const viewerZone = getViewerZone();
  const gutterLabels = getHourLabelsForGutter(daysKyiv, viewerZone);

  if (roomQuery.isPending || bookingsQuery.isPending) {
    return (
      <section className="flex flex-col gap-s5">
        <WeekGridLoading daysCount={7} />
      </section>
    );
  }

  if (roomQuery.isError || bookingsQuery.isError) {
    return (
      <section className="flex flex-col gap-s5">
        <WeekGridError onRetry={() => { void roomQuery.refetch(); void bookingsQuery.refetch(); }}>
          <WeekGridEmpty daysCount={7} />
        </WeekGridError>
      </section>
    );
  }

  const room = roomQuery.data;
  const bookings = bookingsQuery.data?.bookings ?? [];

  const dayBookingsMap = new Map<number, Array<{ booking: (typeof bookings)[number]; startRow: number; span: number }>>();
  for (let i = 0; i < 7; i += 1) {
    dayBookingsMap.set(i, []);
  }

  for (const booking of bookings) {
    const { dayIndex, startRow, span } = getBookingGridRow(booking.startsAt, booking.endsAt);
    if (dayIndex >= 0 && dayIndex < 7) {
      dayBookingsMap.get(dayIndex)?.push({ booking, startRow, span });
    }
  }

  const weekRangeStr = formatKyivWeekRange(mondayKyiv, sundayEndKyiv);
  const subtitleParts: string[] = [];
  if (room?.floor) subtitleParts.push(`${room.floor} поверх`);
  if (room?.capacity) subtitleParts.push(`до ${room.capacity} осіб`);
  if (room?.amenities) subtitleParts.push(room.amenities);
  subtitleParts.push(weekRangeStr);
  const subtitleStr = subtitleParts.join(' · ');

  return (
    <section className="flex flex-col gap-s5">
      <header className="flex flex-col gap-s3">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-s1 text-[14px] font-semibold text-on-primary-container hover:text-primary transition-colors"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>Усі кімнати</span>
          </Link>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-s4 min-w-0">
          <div className="flex flex-col min-w-0">
            <h1 className="font-heading text-h1-fluid-room font-display text-on-surface">
              {room?.name ?? 'Переговорна'}
            </h1>
            <p className="mt-s1 text-body-large text-on-surface-variant">{subtitleStr}</p>
          </div>

          <div className="flex items-center gap-s2 shrink-0">
            <button
              type="button"
              aria-label="Попередній тиждень"
              onClick={() => setSearchParams({ week: getPrevKyivWeekParam(mondayKyiv) })}
              className="size-[40px] rounded-full border border-outline-variant bg-surface-container-lowest flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container"
            >
              ‹
            </button>
            <button
              type="button"
              disabled={weekInfo.isCurrentWeek}
              onClick={() => setSearchParams({})}
              className="h-[40px] px-s4 rounded-full border border-outline-variant bg-surface-container-lowest text-label-large font-bold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container"
            >
              Цей тиждень
            </button>
            <button
              type="button"
              aria-label="Наступний тиждень"
              onClick={() => setSearchParams({ week: getNextKyivWeekParam(mondayKyiv) })}
              className="size-[40px] rounded-full border border-outline-variant bg-surface-container-lowest flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container"
            >
              ›
            </button>
          </div>
        </div>
      </header>

      {/* Legend & Timezone Banner Container */}
      <div className="flex flex-wrap items-center gap-s4 p-s3 px-s4 rounded-[var(--radius-md)] bg-surface-container-low border border-outline-variant text-body-small text-on-surface-variant">
        <div className="flex items-center gap-s2 font-semibold">
          <span className="flex size-[26px] h-[18px] items-center justify-center rounded-[6px] border-2 border-primary bg-primary-container relative shrink-0">
            <span className="size-[6px] rounded-full bg-primary absolute left-[3px] top-[4px]" />
          </span>
          <span>Моє бронювання</span>
        </div>
        <div className="flex items-center gap-s2 font-semibold">
          <span className="flex size-[26px] h-[18px] items-center justify-center rounded-[6px] border border-outline-variant border-l-[4px] border-l-secondary bg-secondary-container shrink-0" />
          <span>Чуже бронювання</span>
        </div>
        <div className="flex items-center gap-s2 font-semibold">
          <span className="flex size-[26px] h-[18px] items-center justify-center rounded-[6px] border border-outline-variant bg-surface-container-lowest shrink-0" />
          <span>Вільно</span>
        </div>
        <div className="flex items-center gap-s2 font-semibold">
          <span className="flex size-[26px] h-[18px] items-center justify-center rounded-[6px] border border-outline-variant bg-[var(--color-past-day)] [background-image:var(--pattern-past-legend)] shrink-0" />
          <span>Минуло</span>
        </div>

        {bookings.length === 0 && (
          <span className="text-on-surface-variant">Цього тижня бронювань немає</span>
        )}

        <div
          className="ml-auto flex items-center gap-s2 rounded-full bg-surface-container px-[13px] py-[6px] text-[12.5px] font-semibold text-on-surface-variant"
          data-testid="timezone-banner"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span>{formatTzBannerText(viewerZone, mondayKyiv)}</span>
        </div>
      </div>

      <div>
        <WeekGridShell
          daysKyiv={daysKyiv}
          gutterLabels={gutterLabels}
          isCurrentWeek={weekInfo.isCurrentWeek}
          renderDayColumn={(dayIndex, _day, pastRowsCount, focusedCoords, onCellFocus) => {
            const dayBookings = dayBookingsMap.get(dayIndex) ?? [];
            const occupiedRows = new Set<number>();
            dayBookings.forEach(({ startRow, span }) => {
              for (let r = startRow; r < startRow + span; r++) {
                occupiedRows.add(r);
              }
            });

            return (
              <>
                {Array.from({ length: 20 }, (_, i) => {
                  const startRow = i + 1;
                  const rowIndex = i;
                  if (startRow <= pastRowsCount || occupiedRows.has(startRow)) {
                    return null;
                  }
                  const isFocused =
                    focusedCoords.dayIndex === dayIndex && focusedCoords.rowIndex === rowIndex;
                  return (
                    <BookingBlock
                      key={`free-${i}`}
                      startRow={startRow}
                      span={1}
                      tabIndex={isFocused ? 0 : -1}
                      dataGridCell={`${dayIndex}-${rowIndex}`}
                      onFocus={() => onCellFocus(dayIndex, rowIndex)}
                    />
                  );
                })}

                {dayBookings.map(({ booking, startRow, span }) => {
                  const startSlotIndex = startRow - 1;
                  const isFocused =
                    focusedCoords.dayIndex === dayIndex &&
                    focusedCoords.rowIndex >= startSlotIndex &&
                    focusedCoords.rowIndex < startSlotIndex + span;

                  return (
                    <div key={booking.id} className="relative z-10 contents">
                      <BookingBlock
                        booking={booking}
                        currentUserId={currentUserId}
                        startRow={startRow}
                        span={span}
                        tabIndex={isFocused ? 0 : -1}
                        dataGridCell={`${dayIndex}-${startSlotIndex}`}
                        onFocus={() => onCellFocus(dayIndex, startSlotIndex)}
                      />
                    </div>
                  );
                })}
              </>
            );
          }}
        />

        <p className="mt-s3 text-right text-body-small text-on-surface-variant">
          Натисніть будь-який вільний слот, щоб забронювати. Свої бронювання можна скасувати — чужі ні.
        </p>
      </div>
    </section>
  );
}
