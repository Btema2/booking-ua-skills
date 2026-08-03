const SLOT_GRID_MINUTES = 30;

/**
 * True when `instant` sits exactly on a 30-minute grid boundary. Checked on
 * the raw UTC fields rather than a Kyiv projection: every Kyiv UTC offset
 * (+2 winter, +3 summer) is a whole number of hours, so a UTC half-hour
 * boundary is always a Kyiv half-hour boundary too.
 */
export function isAligned(instant: Date): boolean {
  return (
    instant.getUTCMinutes() % SLOT_GRID_MINUTES === 0 &&
    instant.getUTCSeconds() === 0 &&
    instant.getUTCMilliseconds() === 0
  );
}

const MILLISECONDS_PER_MINUTE = 60_000;

/** Minutes elapsed from `a` to `b` (negative when `b` precedes `a`). */
export function durationMinutes(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MILLISECONDS_PER_MINUTE;
}
