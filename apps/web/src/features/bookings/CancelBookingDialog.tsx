import type { Booking } from '@booking/core';
import { DateTime } from 'luxon';
import { FormError } from '../../components/FormError';

export interface CancelBookingDialogProps {
  isOpen: boolean;
  booking: Booking | null;
  roomName: string;
  viewerZone: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  isDeleting: boolean;
  error: string | null;
}

export function CancelBookingDialog({
  isOpen,
  booking,
  roomName,
  viewerZone,
  onConfirm,
  onClose,
  isDeleting,
  error,
}: CancelBookingDialogProps) {
  if (!isOpen || !booking) {
    return null;
  }

  const startsAtDt =
    typeof booking.startsAt === 'string'
      ? DateTime.fromISO(booking.startsAt, { zone: 'utc' }).setZone(viewerZone)
      : DateTime.fromJSDate(booking.startsAt, { zone: 'utc' }).setZone(viewerZone);

  const endsAtDt =
    typeof booking.endsAt === 'string'
      ? DateTime.fromISO(booking.endsAt, { zone: 'utc' }).setZone(viewerZone)
      : DateTime.fromJSDate(booking.endsAt, { zone: 'utc' }).setZone(viewerZone);

  const dateStr = startsAtDt.isValid ? startsAtDt.setLocale('uk').toFormat('d MMMM yyyy') : '';
  const timeRangeStr =
    startsAtDt.isValid && endsAtDt.isValid
      ? `${startsAtDt.toFormat('HH:mm')}–${endsAtDt.toFormat('HH:mm')}`
      : '';

  return (
    <div
      className="fixed inset-0 z-[var(--z-dialog,70)] flex items-center justify-center p-4 bg-[var(--color-scrim,rgba(46,43,37,0.44))] backdrop-blur-[var(--blur-scrim-dialog,3px)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-dialog-title"
    >
      <div
        className="w-full max-w-md rounded-[var(--radius-lg,28px)] bg-surface-container-lowest border border-outline-variant p-s5 shadow-[var(--shadow-el-3)] flex flex-col gap-s4 text-on-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="cancel-dialog-title" className="text-headline-medium font-heading font-display text-on-surface">
          Скасувати бронювання?
        </h2>

        {error && <FormError message={error} />}

        <div className="flex flex-col gap-s2 p-s3 rounded-[var(--radius-md,16px)] bg-surface-container-low border border-outline-variant text-body-medium">
          <div>
            <span className="font-semibold text-on-surface-variant">Назва: </span>
            <span className="font-bold text-on-surface">{booking.title}</span>
          </div>
          <div>
            <span className="font-semibold text-on-surface-variant">Кімната: </span>
            <span>{roomName}</span>
          </div>
          <div>
            <span className="font-semibold text-on-surface-variant">Дата й час: </span>
            <span>{dateStr} ({timeRangeStr})</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-s3 mt-s2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="h-[40px] px-s4 rounded-full border border-outline-variant bg-transparent text-label-large font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container"
          >
            Закрити
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isDeleting}
            className="h-[40px] px-s4 rounded-full bg-error text-on-error hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-label-large font-semibold flex items-center justify-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
          >
            {isDeleting && (
              <svg
                className="animate-spin h-4 w-4 text-on-error"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
                data-testid="spinner"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            <span>Скасувати бронювання</span>
          </button>
        </div>
      </div>
    </div>
  );
}
