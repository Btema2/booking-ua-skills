import { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router';
import { DateTime } from 'luxon';
import type { Booking } from '@booking/core';
import { ApiError } from '../../lib/api';
import { useIsMobile } from '../../lib/useIsMobile';
import { useRoomDetails, useRoomBookings } from './useRoomBookings';
import { useCurrentUser } from '../auth/useCurrentUser';
import { EmailVerificationBanner } from '../auth/EmailVerificationBanner';
import {
  getKyivWeek,
  getPrevKyivWeekParam,
  getNextKyivWeekParam,
  getViewerZone,
  getBookingGridRow,
  formatKyivWeekRange,
  formatTzBannerText,
} from './timeUtils';
import { WeekGridShell } from './WeekGridShell';
import { MobileDayPager } from './MobileDayPager';
import { BookingBlock } from './BookingBlock';
import { WeekGridLoading, WeekGridError, DefaultFallbackGrid } from './WeekGridStates';
import { CreateBookingModal } from '../bookings/CreateBookingModal';
import { CancelBookingDialog } from '../bookings/CancelBookingDialog';
import { useCreateBooking, useCreateBookingSeries, useCancelBooking } from '../bookings/useBookingMutations';
import { mapApiErrorToForm } from '../bookings/errorMapping';

export function RoomSchedulePage() {
  const isMobile = useIsMobile(761);
  const { roomId } = useParams<{ roomId: string }>();
  const validRoomId = roomId ?? '';
  const [searchParams, setSearchParams] = useSearchParams();
  const weekParam = searchParams.get('week');
  const dayParam = searchParams.get('day');

  const weekInfo = getKyivWeek(weekParam);
  const { mondayKyiv, sundayEndKyiv, daysKyiv } = weekInfo;

  // Derive selected day index for mobile pager
  let selectedDayIndex = 0;
  if (dayParam) {
    const matchedIdx = daysKyiv.findIndex((d) => d.toISODate() === dayParam);
    if (matchedIdx !== -1) {
      selectedDayIndex = matchedIdx;
    }
  } else if (weekInfo.isCurrentWeek) {
    const todayIso = DateTime.now().setZone('Europe/Kyiv').toISODate();
    const todayIdx = daysKyiv.findIndex((d) => d.toISODate() === todayIso);
    if (todayIdx !== -1) {
      selectedDayIndex = todayIdx;
    }
  }

  const handleSelectDayIndex = (index: number) => {
    const dayIso = daysKyiv[index]?.toISODate();
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (dayIso) {
        next.set('day', dayIso);
      }
      return next;
    });
  };

  const roomQuery = useRoomDetails(validRoomId);
  const bookingsQuery = useRoomBookings(validRoomId, weekInfo);
  const currentUserQuery = useCurrentUser();

  const currentUserId = currentUserQuery.data?.id ?? null;
  const viewerZone = getViewerZone();

  const createMutation = useCreateBooking(validRoomId, weekInfo.weekStartISO);
  const createSeriesMutation = useCreateBookingSeries(validRoomId, weekInfo.weekStartISO);
  const cancelMutation = useCancelBooking(validRoomId, weekInfo.weekStartISO);

  // Modal states for Create Booking
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBannerHighlighted, setIsBannerHighlighted] = useState(false);
  const [selectedSlotCoords, setSelectedSlotCoords] = useState<{ dayIndex: number; rowIndex: number } | null>(null);
  const [selectedSlotInfo, setSelectedSlotInfo] = useState<{
    initialStartISO: string;
    initialEndISO: string;
    dateDisplayStr: string;
  }>({
    initialStartISO: '',
    initialEndISO: '',
    dateDisplayStr: '',
  });
  const [serverFormError, setServerFormError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<{ title?: string; time?: string }>({});

  // Modal states for Cancel Booking
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

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
          <DefaultFallbackGrid daysCount={7} />
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

  const handleFreeSlotClick = (dayIndex: number, rowIndex: number) => {
    if (currentUserQuery.data && !currentUserQuery.data.emailVerifiedAt) {
      setIsBannerHighlighted(true);
      const bannerEl = document.getElementById('email-verification-banner');
      bannerEl?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      bannerEl?.focus();
      return;
    }

    const dayKyiv = daysKyiv[dayIndex];
    const slotStartKyiv = dayKyiv
      .set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      .plus({ minutes: rowIndex * 30 });
    const initialStartISO = slotStartKyiv.toUTC().toISO()!;
    const initialEndISO = slotStartKyiv.plus({ minutes: 30 }).toUTC().toISO()!;
    const dateDisplayStr = dayKyiv.setLocale('uk').toFormat('EEEE, d MMMM');

    setSelectedSlotCoords({ dayIndex, rowIndex });
    setSelectedSlotInfo({ initialStartISO, initialEndISO, dateDisplayStr });
    setServerFormError(null);
    setServerFieldErrors({});
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (values: { title: string; startsAt: string; endsAt: string }) => {
    setServerFormError(null);
    setServerFieldErrors({});
    try {
      await createMutation.mutateAsync({
        roomId: Number(validRoomId),
        title: values.title,
        startsAt: values.startsAt,
        endsAt: values.endsAt,
      });
      setIsCreateOpen(false);
    } catch (err) {
      const mapped = mapApiErrorToForm(err);
      setServerFieldErrors(mapped.fieldErrors);
      setServerFormError(mapped.formError);
    }
  };

  const handleCreateSeriesSubmit = async (values: { title: string; startsAt: string; endsAt: string; occurrenceCount: number }) => {
    setServerFormError(null);
    setServerFieldErrors({});
    try {
      const result = await createSeriesMutation.mutateAsync({
        roomId: Number(validRoomId),
        title: values.title,
        startsAt: values.startsAt,
        endsAt: values.endsAt,
        occurrenceCount: values.occurrenceCount,
      });
      if (result.skipped.length > 0) {
        setServerFormError(`Створено ${result.created.length} з ${result.created.length + result.skipped.length} повторень — решта збігається з наявними бронюваннями.`);
      } else {
        setIsCreateOpen(false);
      }
    } catch (err) {
      const mapped = mapApiErrorToForm(err);
      setServerFieldErrors(mapped.fieldErrors);
      setServerFormError(mapped.formError);
    }
  };

  const handleBookingClick = (booking: Booking) => {
    if (currentUserId && booking.userId === currentUserId) {
      setBookingToCancel(booking);
      setCancelError(null);
      setIsCancelOpen(true);
    }
  };

  const handleCancelConfirm = async (scope?: 'series') => {
    if (!bookingToCancel) return;
    setCancelError(null);
    try {
      await cancelMutation.mutateAsync({ bookingId: bookingToCancel.id, scope });
      setIsCancelOpen(false);
      setBookingToCancel(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Ви не можете скасувати це бронювання';
      setCancelError(msg);
    }
  };

  const renderDayColumn = (
    dayIndex: number,
    _day: unknown,
    pastRowsCount: number,
    focusedCoords: { dayIndex: number; rowIndex: number },
    onCellFocus: (dayIndex: number, rowIndex: number) => void,
  ) => {
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
          const isSelected =
            isCreateOpen &&
            selectedSlotCoords?.dayIndex === dayIndex &&
            selectedSlotCoords?.rowIndex === rowIndex;
          return (
            <BookingBlock
              key={`free-${i}`}
              viewerZone={viewerZone}
              isMobile={isMobile}
              startRow={startRow}
              span={1}
              isSelected={isSelected}
              tabIndex={isFocused ? 0 : -1}
              dataGridCell={`${dayIndex}-${rowIndex}`}
              onFocus={() => onCellFocus(dayIndex, rowIndex)}
              onClick={() => handleFreeSlotClick(dayIndex, rowIndex)}
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
                viewerZone={viewerZone}
                isMobile={isMobile}
                startRow={startRow}
                span={span}
                tabIndex={isFocused ? 0 : -1}
                dataGridCell={`${dayIndex}-${startSlotIndex}`}
                onFocus={() => onCellFocus(dayIndex, startSlotIndex)}
                onClick={() => handleBookingClick(booking)}
              />
            </div>
          );
        })}
      </>
    );
  };

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
              onClick={() => {
                const prevWeek = getPrevKyivWeekParam(mondayKyiv);
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set('week', prevWeek);
                  return next;
                });
              }}
              className="size-[40px] rounded-full border border-outline-variant bg-surface-container-lowest flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container"
            >
              ‹
            </button>
            <button
              type="button"
              disabled={weekInfo.isCurrentWeek}
              onClick={() => {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete('week');
                  return next;
                });
              }}
              className="h-[40px] px-s4 rounded-full border border-outline-variant bg-surface-container-lowest text-label-large font-bold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container"
            >
              Цей тиждень
            </button>
            <button
              type="button"
              aria-label="Наступний тиждень"
              onClick={() => {
                const nextWeek = getNextKyivWeekParam(mondayKyiv);
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set('week', nextWeek);
                  return next;
                });
              }}
              className="size-[40px] rounded-full border border-outline-variant bg-surface-container-lowest flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container"
            >
              ›
            </button>
          </div>
        </div>
      </header>

      <EmailVerificationBanner highlighted={isBannerHighlighted} />

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

      {bookings.length === 0 && (
        <p className="text-body-medium font-semibold text-on-surface-variant">
          Цього тижня бронювань немає
        </p>
      )}

      <div>
        {isMobile ? (
          <MobileDayPager
            daysKyiv={daysKyiv}
            selectedDayIndex={selectedDayIndex}
            onSelectDayIndex={handleSelectDayIndex}
            isCurrentWeek={weekInfo.isCurrentWeek}
            renderDayColumn={renderDayColumn}
          />
        ) : (
          <WeekGridShell
            daysKyiv={daysKyiv}
            weekStartISO={weekInfo.weekStartISO}
            isCurrentWeek={weekInfo.isCurrentWeek}
            renderDayColumn={renderDayColumn}
          />
        )}

        <p className="mt-s3 text-right text-body-small text-on-surface-variant">
          Натисніть будь-який вільний слот, щоб забронювати. Свої бронювання можна скасувати — чужі ні.
        </p>
      </div>

      <CreateBookingModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        roomName={room?.name ?? 'Переговорна'}
        dateDisplayStr={selectedSlotInfo.dateDisplayStr}
        initialStartISO={selectedSlotInfo.initialStartISO}
        initialEndISO={selectedSlotInfo.initialEndISO}
        viewerZone={viewerZone}
        onSubmit={handleCreateSubmit}
        onSubmitSeries={handleCreateSeriesSubmit}
        isSubmitting={createMutation.isPending}
        isSubmittingSeries={createSeriesMutation.isPending}
        serverFormError={serverFormError}
        serverFieldErrors={serverFieldErrors}
        roomId={Number(validRoomId)}
        existingBookings={bookings}
      />

      <CancelBookingDialog
        isOpen={isCancelOpen}
        booking={bookingToCancel}
        roomName={room?.name ?? 'Переговорна'}
        viewerZone={viewerZone}
        onConfirm={handleCancelConfirm}
        onClose={() => {
          setIsCancelOpen(false);
          setBookingToCancel(null);
        }}
        isDeleting={cancelMutation.isPending}
        error={cancelError}
      />
    </section>
  );
}

