import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DateTime } from 'luxon';
import { CreateBookingSchema, overlaps, BOOKING_REJECTION_MESSAGES, OFFICE_OPEN_HOUR, type Booking } from '@booking/core';

export interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  dateDisplayStr: string;
  initialStartISO: string;
  initialEndISO: string;
  viewerZone: string;
  onSubmit: (values: { title: string; startsAt: string; endsAt: string }) => Promise<void>;
  isSubmitting: boolean;
  serverFormError: string | null;
  serverFieldErrors: { title?: string; time?: string };
  roomId?: number;
  existingBookings?: Booking[];
  onSubmitSeries?: (values: { title: string; startsAt: string; endsAt: string; occurrenceCount: number }) => Promise<void>;
  isSubmittingSeries?: boolean;
}

interface FormValues {
  title: string;
  startsAt: string;
  endsAt: string;
}

const formSchema = CreateBookingSchema.omit({ roomId: true }).refine(
  (data) => {
    const start = data.startsAt instanceof Date ? data.startsAt : new Date(data.startsAt);
    const end = data.endsAt instanceof Date ? data.endsAt : new Date(data.endsAt);
    return end > start;
  },
  {
    message: 'Час завершення має бути пізніше за час початку',
    path: ['endsAt'],
  },
);

function add30MinutesISO(isoStr: string): string {
  if (!isoStr) return '';
  const dt = DateTime.fromISO(isoStr, { zone: 'utc' });
  if (!dt.isValid) return isoStr;
  return dt.plus({ minutes: 30 }).toISO()!;
}

function computeInitialEndISO(startISO: string, endISO: string): string {
  if (endISO && endISO.trim() !== '') {
    return endISO;
  }
  return add30MinutesISO(startISO);
}

function getTimeOptions(initialStartISO: string, viewerZone: string) {
  if (!initialStartISO) return { startOptions: [], endOptions: [] };
  const baseKyiv = DateTime.fromISO(initialStartISO, { zone: 'utc' }).setZone('Europe/Kyiv');
  if (!baseKyiv.isValid) return { startOptions: [], endOptions: [] };
  const dayStartKyiv = baseKyiv.startOf('day');

  const allSlots: Array<{ iso: string; label: string }> = [];
  for (let i = 0; i <= 20; i++) {
    const slotDt = dayStartKyiv
      .set({ hour: OFFICE_OPEN_HOUR, minute: 0, second: 0, millisecond: 0 })
      .plus({ minutes: i * 30 });
    const iso = slotDt.toUTC().toISO()!;
    const label = slotDt.setZone(viewerZone).toFormat('HH:mm');
    allSlots.push({ iso, label });
  }

  const startOptions = allSlots.slice(0, 20);
  const endOptions = allSlots.slice(1, 21);

  return { startOptions, endOptions };
}

export function CreateBookingModal({
  isOpen,
  onClose,
  roomName,
  dateDisplayStr,
  initialStartISO,
  initialEndISO,
  viewerZone,
  onSubmit,
  isSubmitting,
  serverFormError,
  serverFieldErrors,
  roomId,
  existingBookings,
  onSubmitSeries,
  isSubmittingSeries,
}: CreateBookingModalProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      title: '',
      startsAt: initialStartISO,
      endsAt: computeInitialEndISO(initialStartISO, initialEndISO),
    },
  });

  const [isRepeating, setIsRepeating] = useState(false);
  const [occurrenceCount, setOccurrenceCount] = useState(8);

  useEffect(() => {
    if (isOpen) {
      reset({
        title: '',
        startsAt: initialStartISO,
        endsAt: computeInitialEndISO(initialStartISO, initialEndISO),
      });
      setIsRepeating(false);
      setOccurrenceCount(8);
    }
  }, [isOpen, initialStartISO, initialEndISO, reset]);

  const watchStartsAt = watch('startsAt');
  const watchEndsAt = watch('endsAt');

  const isOverlapping = useMemo(() => {
    if (!existingBookings || existingBookings.length === 0 || !roomId || !watchStartsAt || !watchEndsAt) {
      return false;
    }
    const startsAt = new Date(watchStartsAt);
    const endsAt = new Date(watchEndsAt);
    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      return false;
    }

    return existingBookings.some(
      (b) =>
        !('canceledAt' in b && (b as { canceledAt?: unknown }).canceledAt) &&
        overlaps(
          { roomId, startsAt, endsAt },
          { roomId: b.roomId, startsAt: new Date(b.startsAt), endsAt: new Date(b.endsAt) },
        ),
    );
  }, [existingBookings, roomId, watchStartsAt, watchEndsAt]);

  if (!isOpen) return null;

  const { startOptions, endOptions } = getTimeOptions(initialStartISO, viewerZone);

  const titleValue = watch('title');
  const isTitleEmpty = !titleValue || titleValue.trim() === '';

  const titleError = serverFieldErrors?.title || errors.title?.message;
  const timeError =
    serverFieldErrors?.time ||
    errors.startsAt?.message ||
    errors.endsAt?.message ||
    (isOverlapping ? BOOKING_REJECTION_MESSAGES.slotTaken : undefined);

  const handleStartChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStart = e.target.value;
    setValue('startsAt', newStart, { shouldValidate: true });
    const newEnd = add30MinutesISO(newStart);
    setValue('endsAt', newEnd, { shouldValidate: true });
  };

  const handleFormSubmit = handleSubmit(async (data) => {
    if (isOverlapping) return;
    const startsAtStr =
      typeof data.startsAt === 'string'
        ? data.startsAt
        : (data.startsAt as Date).toISOString();
    const endsAtStr =
      typeof data.endsAt === 'string'
        ? data.endsAt
        : (data.endsAt as Date).toISOString();

    if (isRepeating && onSubmitSeries) {
      await onSubmitSeries({
        title: data.title,
        startsAt: startsAtStr,
        endsAt: endsAtStr,
        occurrenceCount,
      });
      return;
    }

    await onSubmit({
      title: data.title,
      startsAt: startsAtStr,
      endsAt: endsAtStr,
    });
  });

  const inputStateClass = isSubmitting || isSubmittingSeries
    ? 'opacity-55 bg-surface-container-high cursor-not-allowed'
    : 'bg-surface-container-lowest text-on-surface';

  const titleBorderClass = titleError
    ? 'border-2 border-error text-error'
    : isTitleEmpty
      ? 'border border-dashed border-outline-variant'
      : 'border border-outline-variant focus:border-primary';

  const submitButtonText = isSubmitting || isSubmittingSeries
    ? 'Бронюємо…'
    : serverFormError
      ? 'Повторити'
      : 'Забронювати';

  const closeButtonText = serverFormError ? 'Закрити' : 'Скасувати';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 bg-[var(--color-scrim)] backdrop-blur-[var(--blur-scrim-dialog)] z-[var(--z-dialog)] flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-low text-on-surface rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-el-3)] w-full max-w-[480px] max-h-[90vh] overflow-y-auto z-[var(--z-dialog)] relative cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="modal-title" className="text-headline-medium font-heading text-on-surface">
              Створити бронювання
            </h2>
            <p className="text-body-medium text-on-surface-variant mt-0.5">
              {roomName} · {dateDisplayStr}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити"
            className="text-on-surface-variant hover:text-on-surface text-[20px] font-bold px-2 py-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {serverFormError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-[var(--radius-md)] bg-error-container text-on-error-container text-[14px]"
          >
            {serverFormError}
          </div>
        )}

        <form onSubmit={handleFormSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="title-input"
              className="block text-label-medium text-on-surface-variant font-bold mb-1"
            >
              Назва події
            </label>
            <input
              id="title-input"
              type="text"
              placeholder="Наприклад, Планування спринту"
              disabled={isSubmitting || isSubmittingSeries}
              className={`w-full px-3 py-2 rounded-[var(--radius-sm)] outline-none transition-colors ${inputStateClass} ${titleBorderClass}`}
              {...register('title')}
            />
            {titleError && (
              <p role="alert" className="mt-1 text-error text-[13px]">
                {titleError}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="starts-at-select"
                className="block text-label-medium text-on-surface-variant font-bold mb-1"
              >
                Початок
              </label>
              <select
                id="starts-at-select"
                disabled={isSubmitting || isSubmittingSeries}
                value={watch('startsAt')}
                onChange={handleStartChange}
                className={`w-full px-3 py-2 rounded-[var(--radius-sm)] outline-none transition-colors border border-outline-variant focus:border-primary ${inputStateClass} ${
                  timeError ? 'border-2 border-error' : ''
                }`}
              >
                {startOptions.map((opt) => (
                  <option key={opt.iso} value={opt.iso}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ends-at-select"
                className="block text-label-medium text-on-surface-variant font-bold mb-1"
              >
                Кінець
              </label>
              <select
                id="ends-at-select"
                disabled={isSubmitting || isSubmittingSeries}
                {...register('endsAt')}
                className={`w-full px-3 py-2 rounded-[var(--radius-sm)] outline-none transition-colors border border-outline-variant focus:border-primary ${inputStateClass} ${
                  timeError ? 'border-2 border-error' : ''
                }`}
              >
                {endOptions.map((opt) => (
                  <option key={opt.iso} value={opt.iso}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {timeError && (
            <p role="alert" className="mt-0.5 text-error text-[13px]">
              {timeError}
            </p>
          )}

          {onSubmitSeries && (
            <div className="space-y-3 pt-1 border-t border-outline-variant/30">
              <label className="flex items-center gap-2 cursor-pointer text-body-medium text-on-surface" htmlFor="repeat-toggle">
                <input
                  type="checkbox"
                  id="repeat-toggle"
                  checked={isRepeating}
                  onChange={(e) => setIsRepeating(e.target.checked)}
                  disabled={isSubmitting || isSubmittingSeries}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                <span>Повторювати щотижня</span>
              </label>

              {isRepeating && (
                <div>
                  <label
                    htmlFor="occurrence-count-input"
                    className="block text-label-medium text-on-surface-variant font-bold mb-1"
                  >
                    Кількість повторень
                  </label>
                  <input
                    id="occurrence-count-input"
                    type="number"
                    min={2}
                    max={52}
                    value={occurrenceCount}
                    onChange={(e) => setOccurrenceCount(Number(e.target.value))}
                    disabled={isSubmitting || isSubmittingSeries}
                    className="w-full px-3 py-2 rounded-[var(--radius-sm)] outline-none transition-colors border border-outline-variant focus:border-primary bg-surface-container-lowest text-on-surface"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              {closeButtonText}
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isSubmittingSeries}
              className={`px-5 py-2.5 rounded-full font-medium transition-opacity flex items-center justify-center gap-2 bg-primary text-on-primary hover:opacity-90 ${
                isSubmitting || isSubmittingSeries ? 'opacity-72 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {(isSubmitting || isSubmittingSeries) && (
                <span
                  className="w-[15px] h-[15px] border-2 border-current border-t-transparent rounded-full animate-spin shrink-0"
                  aria-hidden="true"
                />
              )}
              {submitButtonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
