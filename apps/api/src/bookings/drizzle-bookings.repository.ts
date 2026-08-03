import { Injectable } from '@nestjs/common';
import { and, asc, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import { getConnection } from '../db/connection';
import { EXCLUSION_VIOLATION, QueryFailedError, runQuery } from '../db/driver-errors';
import { bookings, users } from '../db/schema';
import { BookingsRepository, SlotTakenError, type BookingRow, type NewBooking, type OwnedBookingRow } from './bookings.repository';

const BOOKING_COLUMNS = {
  id: bookings.id,
  roomId: bookings.roomId,
  title: bookings.title,
  startsAt: bookings.startsAt,
  endsAt: bookings.endsAt,
  userId: bookings.userId,
} as const;

@Injectable()
export class DrizzleBookingsRepository extends BookingsRepository {
  // Resolved per call so building the module never opens a connection pool.
  private get db() {
    return getConnection().db;
  }

  async createBooking(input: NewBooking): Promise<BookingRow> {
    try {
      const [created] = await runQuery('createBooking', () =>
        this.db
          .insert(bookings)
          .values({
            roomId: input.roomId,
            userId: input.userId,
            title: input.title,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
          })
          .returning(BOOKING_COLUMNS),
      );
      // No join here: the creator's name is already known from the session,
      // so a second query just to re-read it back would be a pure N+1.
      return { ...created, userName: input.userName };
    } catch (error) {
      if (error instanceof QueryFailedError && error.code === EXCLUSION_VIOLATION) {
        throw new SlotTakenError();
      }
      throw error;
    }
  }

  async findBookingById(id: string): Promise<OwnedBookingRow | null> {
    const [found] = await runQuery('findBookingById', () =>
      this.db
        .select({ id: bookings.id, userId: bookings.userId, canceledAt: bookings.canceledAt })
        .from(bookings)
        .where(eq(bookings.id, id))
        .limit(1),
    );
    return found ?? null;
  }

  async cancelBooking(id: string): Promise<void> {
    // Soft delete: `bookings_no_overlap` only excludes rows `where (canceled_at
    // is null)`, so stamping this is what actually frees the room's slot again.
    await runQuery('cancelBooking', () => this.db.update(bookings).set({ canceledAt: sql`now()` }).where(eq(bookings.id, id)));
  }

  async listRoomBookings(roomId: number, from: Date, to: Date): Promise<BookingRow[]> {
    return runQuery('listRoomBookings', () =>
      this.db
        .select({ ...BOOKING_COLUMNS, userName: users.name })
        .from(bookings)
        .innerJoin(users, eq(users.id, bookings.userId))
        .where(
          and(
            eq(bookings.roomId, roomId),
            isNull(bookings.canceledAt),
            // Half-open [from, to) intersection, mirroring the EXCLUDE constraint.
            lt(bookings.startsAt, to),
            gt(bookings.endsAt, from),
          ),
        )
        .orderBy(asc(bookings.startsAt)),
    );
  }
}
