import { z } from 'zod';
import { BOOKING_REJECTION_MESSAGES } from '../domain/booking-validation';

const INVALID_DATETIME_MESSAGE = 'Некоректна дата й час';

// react-hook-form already hands us Date objects; the same field arrives as an
// ISO string over HTTP. Normalise both to Date here so callers never branch
// on the source. Alignment/duration/office-hours/past-ness are deliberately
// NOT enforced here — those need an injected `now` and live in
// `validateBookingTimes`, which stays pure and testable.
const DateTimeSchema = z.preprocess((value) => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  }
  return value;
}, z.date({ error: INVALID_DATETIME_MESSAGE }));

export const CreateBookingSchema = z.object({
  roomId: z.number().int().positive(),
  // All three length failures share one message so the 1-100 rule lives in exactly one place.
  title: z
    .string({ error: BOOKING_REJECTION_MESSAGES.title })
    .trim()
    .min(1, { error: BOOKING_REJECTION_MESSAGES.title })
    .max(100, { error: BOOKING_REJECTION_MESSAGES.title }),
  startsAt: DateTimeSchema,
  endsAt: DateTimeSchema,
});

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

export const RoomBookingsQuerySchema = z
  .object({
    from: DateTimeSchema,
    to: DateTimeSchema,
  })
  .refine((query) => query.to > query.from, {
    error: 'Кінець періоду має бути пізніше за початок',
    path: ['to'],
  });

export type RoomBookingsQuery = z.infer<typeof RoomBookingsQuerySchema>;

export const BookingSchema = z.object({
  id: z.uuid(),
  roomId: z.number().int().positive(),
  title: z.string(),
  startsAt: z.date(),
  endsAt: z.date(),
  userId: z.uuid(),
  userName: z.string(),
});

export type Booking = z.infer<typeof BookingSchema>;
