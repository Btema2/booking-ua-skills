import { Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gt, isNull, lt, lte, sql } from 'drizzle-orm';
import { getConnection } from '../db/connection';
import { EXCLUSION_VIOLATION, FOREIGN_KEY_VIOLATION, QueryFailedError, runQuery } from '../db/driver-errors';
import { bookings, rooms, users } from '../db/schema';
import {
  BookingsRepository,
  RoomNotFoundError,
  SlotTakenError,
  type BookingRow,
  type MyBookingRow,
  type NewBooking,
  type OwnedBookingRow,
  type PaginatedMyBookings,
} from './bookings.repository';

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
    const conflicting = await this.listRoomBookings(input.roomId, input.startsAt, input.endsAt);
    if (conflicting.length > 0) {
      throw new SlotTakenError();
    }

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
      // `user_id` is the session's own id, never client-supplied, so this can
      // only be the `room_id` reference — never a raw 500 for a bad roomId.
      if (error instanceof QueryFailedError && error.code === FOREIGN_KEY_VIOLATION) {
        throw new RoomNotFoundError();
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

  async listMyBookings(
    userId: string,
    status: 'upcoming' | 'past',
    page: number,
    limit: number,
  ): Promise<PaginatedMyBookings> {
    const statusCondition =
      status === 'upcoming' ? gt(bookings.endsAt, sql`now()`) : lte(bookings.endsAt, sql`now()`);
    const condition = and(eq(bookings.userId, userId), isNull(bookings.canceledAt), statusCondition);
    const orderBy = status === 'upcoming' ? asc(bookings.startsAt) : desc(bookings.startsAt);

    const [totalResult] = await runQuery('listMyBookingsCount', () =>
      this.db
        .select({ total: count() })
        .from(bookings)
        .innerJoin(rooms, eq(rooms.id, bookings.roomId))
        .innerJoin(users, eq(users.id, bookings.userId))
        .where(condition),
    );
    const total = Number(totalResult?.total ?? 0);

    const offset = (page - 1) * limit;
    const rows = await runQuery('listMyBookings', () =>
      this.db
        .select({
          id: bookings.id,
          roomId: bookings.roomId,
          roomName: rooms.name,
          roomFloor: rooms.floor,
          title: bookings.title,
          startsAt: bookings.startsAt,
          endsAt: bookings.endsAt,
          userId: bookings.userId,
          userName: users.name,
        })
        .from(bookings)
        .innerJoin(rooms, eq(rooms.id, bookings.roomId))
        .innerJoin(users, eq(users.id, bookings.userId))
        .where(condition)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
    );

    return {
      bookings: rows,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }
}

