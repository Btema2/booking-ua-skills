export interface BookingRow {
  id: string;
  roomId: number;
  title: string;
  startsAt: Date;
  endsAt: Date;
  userId: string;
  userName: string;
}

/** Just enough to authorize a cancel: who owns it, and whether it's already gone. */
export interface OwnedBookingRow {
  id: string;
  userId: string;
  canceledAt: Date | null;
}

export interface NewBooking {
  roomId: number;
  userId: string;
  // The creator's own name, known from the session — carried through untouched
  // rather than re-fetched with a join the insert doesn't need.
  userName: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
}

/**
 * Raised by any `BookingsRepository` whose store rejects an insert that would
 * overlap a live booking on the same room. Translating at the persistence
 * boundary keeps SQLSTATE knowledge inside the Drizzle implementation, and
 * lets the in-memory test double signal the same condition without having to
 * imitate a driver error shape.
 */
export class SlotTakenError extends Error {
  constructor() {
    super('Booking slot already taken');
    this.name = 'SlotTakenError';
  }
}

/**
 * Raised when `createBooking`'s insert fails its `room_id` foreign key. The
 * insert's other foreign key, `user_id`, is always the authenticated
 * session's own id and can never be forged by the client, so a foreign-key
 * violation on this insert can only ever mean the referenced room is gone.
 */
export class RoomNotFoundError extends Error {
  constructor() {
    super('Room does not exist');
    this.name = 'RoomNotFoundError';
  }
}

export interface MyBookingRow {
  id: string;
  roomId: number;
  roomName: string;
  roomFloor: number;
  title: string;
  startsAt: Date;
  endsAt: Date;
  userId: string;
  userName: string;
}

export interface PaginatedMyBookings {
  bookings: MyBookingRow[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Persistence boundary for bookings. Abstract class so it doubles as a Nest DI
 * token: production binds the Drizzle implementation, specs bind a double and
 * never touch Postgres.
 */
export abstract class BookingsRepository {
  /**
   * @throws SlotTakenError when the room is already booked for that interval.
   * @throws RoomNotFoundError when roomId does not reference an existing room.
   */
  abstract createBooking(input: NewBooking): Promise<BookingRow>;
  abstract findBookingById(id: string): Promise<OwnedBookingRow | null>;
  /** Soft delete; idempotent at the storage layer, but the service checks state first. */
  abstract cancelBooking(id: string): Promise<void>;
  /** Live bookings only, intersecting `[from, to)`, ordered by `startsAt`. */
  abstract listRoomBookings(roomId: number, from: Date, to: Date): Promise<BookingRow[]>;
  abstract listMyBookings(
    userId: string,
    status: 'upcoming' | 'past',
    page: number,
    limit: number,
  ): Promise<PaginatedMyBookings>;
}

