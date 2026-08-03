export interface BookingInterval {
  roomId: number;
  startsAt: Date;
  endsAt: Date;
}

/**
 * Mirrors the Postgres EXCLUDE constraint's `tstzrange(startsAt, endsAt, '[)')`
 * overlap check bit-for-bit, so the UI can reject a doomed booking before the
 * round trip — the database, not this function, is what actually enforces it.
 * Half-open: the end instant is excluded, so back-to-back bookings don't conflict.
 */
export function overlaps(a: BookingInterval, b: BookingInterval): boolean {
  if (a.roomId !== b.roomId) return false;
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}
