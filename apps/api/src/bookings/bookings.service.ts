import type { CreateBookingInput, CreateBookingSeriesInput, MyBookingsQuery, PublicUser } from '@booking/core';
import { validateBookingTimes, weeklyOccurrences } from '@booking/core';
import { Injectable } from '@nestjs/common';
import {
  allOccurrencesTaken,
  bookingAlreadyCanceled,
  bookingNotFound,
  bookingTimeRejection,
  cannotCancelOthersBooking,
  emailVerificationRequired,
  notPartOfSeries,
  roomNotFound,
  slotTaken,
} from './bookings.errors';
import {
  BookingsRepository,
  RoomNotFoundError,
  SlotTakenError,
  type BookingRow,
  type NewBooking,
  type PaginatedMyBookings,
} from './bookings.repository';

export interface CreateSeriesResult {
  series: { id: string };
  created: BookingRow[];
  skipped: { startsAt: Date; endsAt: Date }[];
}

@Injectable()
export class BookingsService {
  constructor(private readonly bookingsRepo: BookingsRepository) {}

  async create(user: PublicUser, input: CreateBookingInput): Promise<BookingRow> {
    if (!user.emailVerifiedAt) {
      throw emailVerificationRequired();
    }

    // `new Date()` is read here, and only here — packages/core stays pure and
    // testable, taking `now` as a parameter instead.
    const rejection = validateBookingTimes(input, new Date());
    if (rejection) {
      throw bookingTimeRejection(rejection);
    }

    try {
      return await this.bookingsRepo.createBooking({
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
    const booking = await this.bookingsRepo.findBookingById(bookingId);
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
    await this.bookingsRepo.cancelBooking(bookingId);
  }

  async listForRoom(roomId: number, from: Date, to: Date): Promise<BookingRow[]> {
    return this.bookingsRepo.listRoomBookings(roomId, from, to);
  }

  async listMine(user: PublicUser, query: MyBookingsQuery): Promise<PaginatedMyBookings> {
    return this.bookingsRepo.listMyBookings(user.id, query.status, query.page, query.limit);
  }

  async createSeries(user: PublicUser, input: CreateBookingSeriesInput): Promise<CreateSeriesResult> {
    if (!user.emailVerifiedAt) {
      throw emailVerificationRequired();
    }

    const now = new Date();
    const occurrences = weeklyOccurrences(input.startsAt, input.endsAt, input.occurrenceCount);

    // Every occurrence's alignment/duration/office-hours must be valid
    // before any insert happens — a later occurrence can fail purely
    // because a DST transition shifted its Kyiv wall-clock time, and that
    // is an input problem with the whole request, not a per-occurrence
    // conflict like slotTaken.
    for (const occurrence of occurrences) {
      const rejection = validateBookingTimes(occurrence, now);
      if (rejection) {
        throw bookingTimeRejection(rejection);
      }
    }

    const series = await this.bookingsRepo.createBookingSeries(user.id);
    const created: BookingRow[] = [];
    const skipped: { startsAt: Date; endsAt: Date }[] = [];

    for (const occurrence of occurrences) {
      try {
        const row = await this.bookingsRepo.createBooking({
          roomId: input.roomId,
          userId: user.id,
          userName: user.name,
          title: input.title,
          startsAt: occurrence.startsAt,
          endsAt: occurrence.endsAt,
          seriesId: series.id,
        });
        created.push(row);
      } catch (error) {
        if (error instanceof SlotTakenError) {
          skipped.push(occurrence);
          continue;
        }
        if (error instanceof RoomNotFoundError) {
          throw roomNotFound();
        }
        throw error;
      }
    }

    if (created.length === 0) {
      // No occurrence made it in — leave no orphan booking_series row
      // behind for a psql inspection to find.
      await this.bookingsRepo.deleteBookingSeries(series.id);
      throw allOccurrencesTaken();
    }

    return { series: { id: series.id }, created, skipped };
  }

  async cancelSeries(user: PublicUser, bookingId: string): Promise<void> {
    const info = await this.bookingsRepo.findBookingOwnershipAndSeries(bookingId);
    if (!info) {
      throw bookingNotFound();
    }
    // Ownership checked before series membership, mirroring `cancel()`'s
    // ownership-before-state ordering: a stranger probing someone else's
    // booking id always gets the same 403, never a 400 that would leak
    // whether the booking is part of a series.
    if (info.userId !== user.id) {
      throw cannotCancelOthersBooking();
    }
    if (!info.seriesId) {
      throw notPartOfSeries();
    }
    await this.bookingsRepo.cancelBookingSeries(info.seriesId);
  }
}
