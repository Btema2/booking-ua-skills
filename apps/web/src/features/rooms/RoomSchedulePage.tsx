import { useParams, Link } from 'react-router';
import { useRoomDetails, useRoomBookings } from './useRoomBookings';
import { useCurrentUser } from '../auth/useCurrentUser';
import { getCurrentKyivWeek, getViewerZone, getHourLabelsForGutter, getBookingGridRow } from './timeUtils';
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
  const { daysKyiv } = getCurrentKyivWeek();
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

  return (
    <section className="flex flex-col gap-s5">
      <header className="flex flex-col gap-s2">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-s1 text-title-small text-on-surface-variant hover:text-on-surface transition-colors"
          >
            ← Всі кімнати
          </Link>
        </div>
        <div className="flex w-full items-start justify-between gap-s3">
          <div className="min-w-0">
            <h1 className="font-heading text-h1-fluid-room font-display text-on-surface">
              {room?.name ?? 'Переговорна'}
            </h1>
            {room?.amenities ? (
              <p className="mt-s1 text-body-small text-on-surface-variant">{room.amenities}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-s2 shrink-0">
            {room?.capacity ? (
              <span className="flex size-[var(--room-cap-badge)] items-center justify-center rounded-full bg-primary-container text-[15px] font-strong text-on-primary-container">
                <span aria-hidden="true">{room.capacity}</span>
                <span className="sr-only">Місткість: {peopleLabel(room.capacity)}</span>
              </span>
            ) : null}
            {room?.floor ? (
              <span className="rounded-full bg-tertiary-container p-[var(--room-tag-pad)] text-label-medium text-on-tertiary-container">
                <span aria-hidden="true">{room.floor} поверх</span>
                <span className="sr-only">Поверх {room.floor}</span>
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {bookings.length === 0 ? (
        <WeekGridEmpty daysCount={7} />
      ) : (
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
      )}
    </section>
  );
}
