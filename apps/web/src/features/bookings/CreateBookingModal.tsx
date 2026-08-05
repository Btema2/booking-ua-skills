import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DateTime } from 'luxon';
import { CreateBookingSchema } from '@booking/core';

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
      .set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
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

  useEffect(() => {
    if (isOpen) {
      reset({
        title: '',
        startsAt: initialStartISO,
        endsAt: computeInitialEndISO(initialStartISO, initialEndISO),
      });
    }
  }, [isOpen, initialStartISO, initialEndISO, reset]);

  if (!isOpen) return null;

  const { startOptions, endOptions } = getTimeOptions(initialStartISO, viewerZone);

  const titleValue = watch('title');
  const isTitleEmpty = !titleValue || titleValue.trim() === '';

  const titleError = serverFieldErrors?.title || errors.title?.message;
  const timeError =
    serverFieldErrors?.time || errors.startsAt?.message || errors.endsAt?.message;

  const handleStartChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStart = e.target.value;
    setValue('startsAt', newStart, { shouldValidate: true });
    const newEnd = add30MinutesISO(newStart);
    setValue('endsAt', newEnd, { shouldValidate: true });
  };

  const handleFormSubmit = handleSubmit(
    async (data) => {
      console.log('Form submitted with valid data:', data);
      const startsAtStr =
        typeof data.startsAt === 'string'
          ? data.startsAt
          : (data.startsAt as Date).toISOString();
      const endsAtStr =
        typeof data.endsAt === 'string'
          ? data.endsAt
          : (data.endsAt as Date).toISOString();
      await onSubmit({
        title: data.title,
        startsAt: startsAtStr,
        endsAt: endsAtStr,
      });
    },
    (invalidErrors) => {
      console.log('Form submission invalid errors:', invalidErrors);
    },
  );

  const inputStateClass = isSubmitting
    ? 'opacity-55 bg-surface-container-high cursor-not-allowed'
    : 'bg-surface-container-lowest text-on-surface';

  const titleBorderClass = titleError
    ? 'border-2 border-error text-error'
    : isTitleEmpty
      ? 'border border-dashed border-outline-variant'
      : 'border border-outline-variant focus:border-primary';

  const submitButtonText = isSubmitting
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
      className="fixed inset-0 bg-[var(--color-scrim)] backdrop-blur-[var(--blur-scrim-dialog)] z-[var(--z-dialog)] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-low text-on-surface rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-el-3)] w-full max-w-[480px] z-[var(--z-dialog)] relative cursor-default"
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
              disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
              disabled={isSubmitting}
              className={`px-5 py-2.5 rounded-full font-medium transition-opacity flex items-center justify-center gap-2 bg-primary text-on-primary hover:opacity-90 ${
                isSubmitting ? 'opacity-72 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {isSubmitting && (
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
