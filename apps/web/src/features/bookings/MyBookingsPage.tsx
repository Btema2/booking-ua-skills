import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { getKyivWeekParamForInstant } from '@booking/core';
import { apiRequest } from '../../lib/api';
import { getViewerZone } from '../rooms/timeUtils';
import { CancelBookingDialog } from './CancelBookingDialog';

export interface MyBookingRow {
  id: string;
  roomId: number;
  roomName: string;
  roomFloor: number;
  title: string;
  startsAt: string | Date;
  endsAt: string | Date;
  userId: string;
  userName: string;
}

export interface PaginatedMyBookings {
  bookings: MyBookingRow[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export function MyBookingsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Завантаження" className="flex flex-col gap-s3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-s4 rounded-[var(--radius-md,16px)] border border-outline-variant bg-surface-container-lowest p-s4 max-[760px]:flex-col max-[760px]:items-start max-[760px]:p-[14px_16px]"
        >
          <div className="flex items-center gap-s4 w-full">
            <span className="skeleton-bar block size-[40px] shrink-0 rounded-[var(--radius-sm,8px)]" />
            <div className="flex flex-1 flex-col gap-s2">
              <span className="skeleton-bar block h-4 w-44 rounded-md" />
              <span className="skeleton-bar block h-3 w-32 rounded-sm" />
            </div>
          </div>
          <span className="skeleton-bar block h-7 w-32 shrink-0 rounded-full max-[760px]:w-full" />
        </div>
      ))}
    </div>
  );
}

function MyBookingsEmpty({ tab }: { tab: 'upcoming' | 'past' }) {
  const navigate = useNavigate();
  const message = tab === 'upcoming' ? 'Майбутніх бронювань немає' : 'Минулих бронювань немає';

  return (
    <div className="flex flex-col items-center justify-center py-s12 text-center">
      <div className="mb-s4 grid size-[64px] place-items-center rounded-full bg-secondary-container text-on-secondary-container">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="size-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
      <p className="mb-s6 text-title-medium font-semibold text-on-surface">{message}</p>
      <button
        type="button"
        onClick={() => navigate('/rooms')}
        className="inline-flex h-[40px] items-center justify-center rounded-full bg-primary px-s6 text-label-large font-semibold text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container"
      >
        Обрати кімнату
      </button>
    </div>
  );
}

export function MyBookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const tabParam = searchParams.get('tab');
  const tab: 'upcoming' | 'past' = tabParam === 'past' ? 'past' : 'upcoming';

  const pageParam = searchParams.get('page');
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);

  const [bookingToCancel, setBookingToCancel] = useState<MyBookingRow | null>(null);

  const viewerZone = getViewerZone();
  const queryKey = ['my-bookings', tab, page];

  const { data, isPending, isError, refetch } = useQuery<PaginatedMyBookings>({
    queryKey,
    queryFn: () => apiRequest<PaginatedMyBookings>(`/bookings/mine?status=${tab}&page=${page}`),
  });

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) =>
      apiRequest<void>(`/bookings/${bookingId}`, { method: 'DELETE' }),
    onMutate: async (bookingId: string) => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<PaginatedMyBookings>(queryKey);

      if (previousData) {
        queryClient.setQueryData<PaginatedMyBookings>(queryKey, {
          ...previousData,
          bookings: previousData.bookings.filter((b) => b.id !== bookingId),
          total: Math.max(0, previousData.total - 1),
        });
      }

      return { previousData };
    },
    onError: (_err, _bookingId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['room'] });
    },
  });

  const handleConfirmCancel = async () => {
    if (!bookingToCancel) return;
    try {
      await cancelMutation.mutateAsync(bookingToCancel.id);
      setBookingToCancel(null);
    } catch {
      // Error state captured by mutation and shown inside CancelBookingDialog
    }
  };

  const handleTabChange = (newTab: 'upcoming' | 'past') => {
    setSearchParams({ tab: newTab, page: '1' });
  };

  const total = data?.total ?? 0;
  const limit = data?.limit ?? 10;
  const totalPages = Math.ceil(total / limit);

  const showPagination =
    Boolean(data) &&
    data!.bookings.length > 0 &&
    (tab === 'past' || totalPages > 1 || page > 1 || data!.hasMore);

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <h1 className="mb-s4 font-heading text-headline-medium font-bold text-on-surface">
        Мої бронювання
      </h1>

      {/* Tabs */}
      <div role="tablist" className="mb-s6 flex items-center gap-s2 border-b border-outline-variant pb-s3">
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'upcoming'}
          onClick={() => handleTabChange('upcoming')}
          className={[
            'rounded-full px-s4 py-s2 text-label-large font-semibold transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container',
            tab === 'upcoming'
              ? 'bg-surface-container-highest text-on-surface'
              : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
          ].join(' ')}
        >
          Майбутні
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'past'}
          onClick={() => handleTabChange('past')}
          className={[
            'rounded-full px-s4 py-s2 text-label-large font-semibold transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container',
            tab === 'past'
              ? 'bg-surface-container-highest text-on-surface'
              : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
          ].join(' ')}
        >
          Минулі
        </button>
      </div>

      {/* Error Banner */}
      {isError && (
        <div
          role="alert"
          className="mb-s4 flex items-center justify-between rounded-md bg-error-container p-s3 text-on-error-container"
        >
          <span className="text-body-medium font-medium">Не вдалося оновити список</span>
          <button
            type="button"
            onClick={() => void refetch()}
            className="cursor-pointer rounded-full bg-on-error-container px-s4 py-s2 text-label-large font-semibold text-on-error transition-colors hover:bg-on-error-container/90"
          >
            Повторити
          </button>
        </div>
      )}

      {/* Loading State */}
      {isPending && !data && <MyBookingsSkeleton />}

      {/* Content / List / Empty */}
      {!isPending && (!data || data.bookings.length === 0) && !isError && (
        <MyBookingsEmpty tab={tab} />
      )}

      {data && data.bookings.length > 0 && (
        <div className="flex flex-col gap-s3">
          {data.bookings.map((row) => {
            const startsAtDt =
              typeof row.startsAt === 'string'
                ? DateTime.fromISO(row.startsAt, { zone: 'utc' }).setZone(viewerZone)
                : DateTime.fromJSDate(row.startsAt, { zone: 'utc' }).setZone(viewerZone);

            const endsAtDt =
              typeof row.endsAt === 'string'
                ? DateTime.fromISO(row.endsAt, { zone: 'utc' }).setZone(viewerZone)
                : DateTime.fromJSDate(row.endsAt, { zone: 'utc' }).setZone(viewerZone);

            const dateStr = startsAtDt.setLocale('uk').toFormat('d MMMM yyyy');
            const timeRangeStr = `${startsAtDt.toFormat('HH:mm')}–${endsAtDt.toFormat('HH:mm')}`;

            const startsAtKyiv =
              typeof row.startsAt === 'string'
                ? DateTime.fromISO(row.startsAt, { zone: 'utc' }).setZone('Europe/Kyiv')
                : DateTime.fromJSDate(row.startsAt, { zone: 'utc' }).setZone('Europe/Kyiv');
            const dayIso = startsAtKyiv.toISODate();
            const weekParam = getKyivWeekParamForInstant(row.startsAt);

            return (
              <div
                key={row.id}
                onClick={() =>
                  navigate(
                    `/rooms/${row.roomId}?week=${weekParam}&day=${dayIso}`,
                  )
                }
                className={[
                  'group flex items-center justify-between gap-s4 cursor-pointer',
                  'rounded-[var(--radius-md,16px)] border border-outline-variant bg-surface-container-lowest p-s4',
                  'transition-colors hover:bg-surface-container-low',
                  'max-[760px]:flex-col max-[760px]:items-start max-[760px]:p-[14px_16px] max-[760px]:w-full',
                ].join(' ')}
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-s2 flex-wrap text-label-large font-semibold text-on-surface-variant">
                    <span>{dateStr}</span>
                    <span className="text-outline">•</span>
                    <span>{timeRangeStr}</span>
                    <span className="text-outline">•</span>
                    <span>
                      {row.roomName} · {row.roomFloor} поверх
                    </span>
                  </div>
                  <h3 className="text-title-medium font-bold text-on-surface truncate max-[760px]:whitespace-normal max-[760px]:overflow-visible max-[760px]:text-clip max-[760px]:wrap-anywhere">
                    {row.title}
                  </h3>
                </div>

                {tab === 'upcoming' && (
                  <button
                    type="button"
                    disabled={isError || cancelMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      setBookingToCancel(row);
                    }}
                    className={[
                      'shrink-0 h-[36px] px-s4 rounded-full border border-outline-variant bg-transparent',
                      'text-label-large font-semibold text-error hover:bg-error-container hover:text-on-error-container',
                      'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error',
                      'max-[760px]:w-full max-[760px]:mt-s2',
                    ].join(' ')}
                  >
                    Скасувати
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {showPagination && (
        <nav aria-label="Пагінація" className="mt-s6 flex items-center justify-between border-t border-outline-variant pt-s4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setSearchParams({ tab, page: String(page - 1) })}
            className="rounded-full border border-outline-variant px-s4 py-s2 text-label-large font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
          >
            Попередня
          </button>
          <span className="text-body-medium font-medium text-on-surface-variant">
            Сторінка {page}
          </span>
          <button
            type="button"
            disabled={!data?.hasMore && (totalPages === 0 || page >= totalPages)}
            onClick={() => setSearchParams({ tab, page: String(page + 1) })}
            className="rounded-full border border-outline-variant px-s4 py-s2 text-label-large font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
          >
            Наступна
          </button>
        </nav>
      )}

      {/* Cancel Booking Dialog */}
      <CancelBookingDialog
        isOpen={Boolean(bookingToCancel)}
        booking={
          bookingToCancel
            ? {
                id: bookingToCancel.id,
                roomId: bookingToCancel.roomId,
                title: bookingToCancel.title,
                startsAt:
                  typeof bookingToCancel.startsAt === 'string'
                    ? new Date(bookingToCancel.startsAt)
                    : bookingToCancel.startsAt,
                endsAt:
                  typeof bookingToCancel.endsAt === 'string'
                    ? new Date(bookingToCancel.endsAt)
                    : bookingToCancel.endsAt,
                userId: bookingToCancel.userId,
                userName: bookingToCancel.userName,
                // MyBookingRow doesn't carry series membership (listMyBookings
                // is out of scope for Phase 8.4 — see the design doc), so the
                // My Bookings page's cancel dialog never offers a
                // whole-series choice; only the room week-grid does, where
                // the booking comes from listRoomBookings and does carry it.
                seriesId: null,
              }
            : null
        }
        roomName={bookingToCancel?.roomName ?? ''}
        viewerZone={viewerZone}
        onConfirm={handleConfirmCancel}
        onClose={() => {
          setBookingToCancel(null);
          cancelMutation.reset();
        }}
        isDeleting={cancelMutation.isPending}
        error={cancelMutation.error ? cancelMutation.error.message : null}
      />
    </div>
  );
}
