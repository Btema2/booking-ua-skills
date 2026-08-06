import { BOOKING_REJECTION_MESSAGES, type BookingRejection } from '@booking/core';
import { BadRequestException, ConflictException, ForbiddenException, HttpStatus, NotFoundException } from '@nestjs/common';

const BOOKING_NOT_FOUND_MESSAGE = 'Бронювання не знайдено';
const CANNOT_CANCEL_OTHERS_BOOKING_MESSAGE = 'Ви не можете скасувати чуже бронювання';
const BOOKING_ALREADY_CANCELED_MESSAGE = 'Це бронювання вже скасовано';
const ROOM_NOT_FOUND_MESSAGE = 'Обраної кімнати не існує';

// The payloads are built explicitly rather than from the exception's default
// shape, because the client contract fixes them at `{ statusCode, message }`.
export function slotTaken(): ConflictException {
  return new ConflictException({ statusCode: HttpStatus.CONFLICT, message: BOOKING_REJECTION_MESSAGES.slotTaken });
}

export function bookingNotFound(): NotFoundException {
  return new NotFoundException({ statusCode: HttpStatus.NOT_FOUND, message: BOOKING_NOT_FOUND_MESSAGE });
}

export function cannotCancelOthersBooking(): ForbiddenException {
  return new ForbiddenException({ statusCode: HttpStatus.FORBIDDEN, message: CANNOT_CANCEL_OTHERS_BOOKING_MESSAGE });
}

export function emailVerificationRequired(): ForbiddenException {
  return new ForbiddenException({
    statusCode: HttpStatus.FORBIDDEN,
    message: 'Для створення бронювання необхідно підтвердити пошту',
  });
}

export function bookingAlreadyCanceled(): ConflictException {
  return new ConflictException({ statusCode: HttpStatus.CONFLICT, message: BOOKING_ALREADY_CANCELED_MESSAGE });
}

// 400 under `roomId`, not 404: the resource the client asked to create is the
// *booking*, so a bad reference inside the body is a rejected input, not a
// missing endpoint — and the field-error shape is what the form already
// knows how to render, per SPEC §2 ("everything else about a failed insert
// is a 400").
export function roomNotFound(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    errors: { roomId: [ROOM_NOT_FOUND_MESSAGE] },
  });
}

// `validateBookingTimes` never returns 'title' (the Zod schema owns that) or
// 'slotTaken' (only Postgres's EXCLUDE constraint can decide that) — every
// rejection that does reach here describes the chosen instant, so it attaches
// to `startsAt` and reuses the documented `{ statusCode, errors }` shape.
const BOOKING_TIME_FIELD = 'startsAt';

export function bookingTimeRejection(rejection: BookingRejection): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    errors: { [BOOKING_TIME_FIELD]: [BOOKING_REJECTION_MESSAGES[rejection]] },
  });
}
