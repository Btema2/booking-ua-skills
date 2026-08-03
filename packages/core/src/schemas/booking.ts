import { z } from 'zod';
import { BOOKING_REJECTION_MESSAGES } from '../domain/booking-validation';
import { POSTGRES_INT4_MAX } from './room';

const INVALID_DATETIME_MESSAGE = 'Некоректна дата й час';
const INVALID_ROOM_MESSAGE = 'Некоректна кімната';

// A string with no offset designator (`Z` or `±HH:MM`) is, per ECMAScript,
// parsed in the *host's* local time zone rather than UTC, so the same request
// body would resolve to a different instant depending on where the API process
// runs. `z.iso.datetime({ offset: true })` demands the designator and rejects
// date-only strings, rather than a hand-rolled pattern that would also have to
// get optional seconds and fractional digits right.
const IsoInstantSchema = z.iso.datetime({ offset: true, error: INVALID_DATETIME_MESSAGE });

// react-hook-form already hands us Date objects; the same field arrives as an
// ISO string over HTTP. Normalise both to Date here so callers never branch
// on the source. Alignment/duration/office-hours/past-ness are deliberately
// NOT enforced here — those need an injected `now` and live in
// `validateBookingTimes`, which stays pure and testable.
const DateTimeSchema = z.preprocess((value) => {
  if (value instanceof Date) return value;
  return typeof value === 'string' && IsoInstantSchema.safeParse(value).success ? new Date(value) : value;
}, z.date({ error: INVALID_DATETIME_MESSAGE }));

// `rooms.id` is a serial, so anything past the int4 ceiling raises SQLSTATE
// 22003 in the driver rather than failing validation. Every bound carries the
// same Ukrainian message: to a user there is one failure here, "no such room",
// and Zod's English defaults would otherwise reach the response body.
export const RoomIdSchema = z
  .number({ error: INVALID_ROOM_MESSAGE })
  .int({ error: INVALID_ROOM_MESSAGE })
  .positive({ error: INVALID_ROOM_MESSAGE })
  .max(POSTGRES_INT4_MAX, { error: INVALID_ROOM_MESSAGE });

// A room id in a URL path arrives as text, so it is coerced before the shared
// rule runs. The coercion carries the same message because `/rooms/abc` would
// otherwise answer with Zod's English "expected number, received NaN".
export const RoomIdPathSchema = z.coerce.number({ error: INVALID_ROOM_MESSAGE }).pipe(RoomIdSchema);

export const CreateBookingSchema = z.object({
  roomId: RoomIdSchema,
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
