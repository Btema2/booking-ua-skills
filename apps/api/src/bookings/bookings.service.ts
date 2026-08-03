import type { CreateBookingInput, PublicUser } from '@booking/core';
import { validateBookingTimes } from '@booking/core';
import { Injectable } from '@nestjs/common';
import {
  bookingAlreadyCanceled,
  bookingNotFound,
  bookingTimeRejection,
  cannotCancelOthersBooking,
  roomNotFound,
  slotTaken,
} from './bookings.errors';
import { BookingsRepository, RoomNotFoundError, SlotTakenError, type BookingRow } from './bookings.repository';

@Injectable()
export class BookingsService {
  constructor(private readonly repository: BookingsRepository) {}

  async create(user: PublicUser, input: CreateBookingInput): Promise<BookingRow> {
    // `new Date()` is read here, and only here — packages/core stays pure and
    // testable, taking `now` as a parameter instead.
    const rejection = validateBookingTimes(input, new Date());
    if (rejection) {
      throw bookingTimeRejection(rejection);
    }

    try {
      return await this.repository.createBooking({
        roomId: input.roomId,
        userId: user.id,
        userName: user.name,
        title: input.title,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      });
    } catch (error) {
      if (error instanceof SlotTakenError) {
        throw slotTaken();
      }
      if (error instanceof RoomNotFoundError) {
        throw roomNotFound();
      }
      throw error;
    }
  }

  async cancel(user: PublicUser, bookingId: string): Promise<void> {
    const booking = await this.repository.findBookingById(bookingId);
    if (!booking) {
      throw bookingNotFound();
    }
    // Ownership is checked before "already cancelled", so a stranger probing
    // someone else's booking id always gets the same 403 either way, never a
    // 409 that would leak whether the booking still exists.
    if (booking.userId !== user.id) {
      throw cannotCancelOthersBooking();
    }
    if (booking.canceledAt) {
      throw bookingAlreadyCanceled();
    }
    await this.repository.cancelBooking(bookingId);
  }

  async listForRoom(roomId: number, from: Date, to: Date): Promise<BookingRow[]> {
    return this.repository.listRoomBookings(roomId, from, to);
  }
}
