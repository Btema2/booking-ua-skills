import { useParams, Link } from 'react-router';
import { useRoomDetails, useRoomBookings } from './useRoomBookings';
import { useCurrentUser } from '../auth/useCurrentUser';
import { getCurrentKyivWeek, getViewerZone, getHourLabelsForGutter, getBookingGridRow, formatKyivWeekRange } from './timeUtils';
import { WeekGridShell } from './WeekGridShell';
import { BookingBlock } from './BookingBlock';
import { WeekGridLoading, WeekGridEmpty, WeekGridError } from './WeekGridStates';
import { peopleLabel } from './plural';

export function RoomSchedulePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const validRoomId = roomId ?? '';
  const roomQuery = useRoomDetails(validRoomId);
  const bookingsQuery = useRoomBookings(validRoomId);
  const currentUserQuery = useCurrentUser();

  const currentUserId = currentUserQuery.data?.id ?? null;
  const { mondayKyiv, sundayEndKyiv, daysKyiv } = getCurrentKyivWeek();
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
      <header className="flex flex-col gap-s2">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-s1 text-title-small text-on-surface-variant hover:text-on-surface transition-colors"
          >
            ← Усі кімнати
          </Link>
        </div>
        <div className="flex flex-col min-w-0">
          <h1 className="font-heading text-h1-fluid-room font-display text-on-surface">
            {room?.name ?? 'Переговорна'}
          </h1>
          <p className="mt-s1 text-body-large text-on-surface-variant">{subtitleStr}</p>
        </div>
      </header>

      {/* Legend Row */}
      <div className="flex flex-wrap items-center gap-s4 text-body-small text-on-surface-variant">
        <div className="flex items-center gap-s2">
          <span className="flex size-4 items-center justify-center rounded-[4px] border-2 border-primary bg-primary-container">
            <span className="size-[5px] rounded-full bg-primary" />
          </span>
          <span>Моє бронювання</span>
        </div>
        <div className="flex items-center gap-s2">
          <span className="flex size-4 items-center justify-center rounded-[4px] border border-outline-variant border-l-[3px] border-l-secondary bg-secondary-container">
            <svg viewBox="0 0 24 24" width="8" height="8" stroke="var(--color-secondary)" strokeWidth="2.5" fill="none">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <span>Чуже бронювання</span>
        </div>
        <div className="flex items-center gap-s2">
          <span className="flex size-4 items-center justify-center rounded-[4px] border border-outline-variant bg-surface-container-lowest text-[10px] font-bold text-on-surface-variant">
            +
          </span>
          <span>Вільно</span>
        </div>
        <div className="flex items-center gap-s2">
          <span className="size-4 rounded-[4px] border border-outline-variant bg-[var(--color-past-day)] [background-image:var(--pattern-past)]" />
          <span>Минуло</span>
        </div>
      </div>

      {bookings.length === 0 ? (
        <WeekGridEmpty daysCount={7} />
      ) : (
        <div>
          <WeekGridShell
            daysKyiv={daysKyiv}
            gutterLabels={gutterLabels}
            renderDayColumn={(dayIndex) => {
              const dayBookings = dayBookingsMap.get(dayIndex) ?? [];
              return (
                <>
                  {Array.from({ length: 20 }, (_, i) => (
                    <BookingBlock key={`free-${i}`} startRow={i + 1} span={1} />
                  ))}

                  {dayBookings.map(({ booking, startRow, span }) => (
                    <div key={booking.id} className="relative z-10 contents">
                      <BookingBlock
                        booking={booking}
                        currentUserId={currentUserId}
                        startRow={startRow}
                        span={span}
                      />
                    </div>
                  ))}
                </>
              );
            }}
          />
          <p className="mt-s3 text-center text-body-small text-on-surface-variant">
            Натисніть будь-який вільний слот, щоб забронювати. Свої бронювання можна скасувати — чужі ні.
          </p>
        </div>
      )}
    </section>
  );
}
