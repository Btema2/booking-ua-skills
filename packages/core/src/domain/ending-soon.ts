export interface EndingSoonCheck {
  now: Date;
  endsAt: Date;
  notifyBeforeMinutes: number;
  /** Whether a live booking already starts exactly when this one ends, in the same room. */
  isNextSlotTaken: boolean;
}

/**
 * The one decision behind the end-of-booking notification: fire while `now` is
 * inside the trailing `notifyBeforeMinutes` window before `endsAt` (inclusive
 * of the threshold, exclusive of the end itself), and only when the room's
 * next slot is already taken. Takes `now` as a parameter rather than reading
 * the clock, so the scheduler's periodic tick and this decision stay testable
 * independently of each other and of the database.
 */
export function shouldNotifyBookingEnding({ now, endsAt, notifyBeforeMinutes, isNextSlotTaken }: EndingSoonCheck): boolean {
  if (!isNextSlotTaken) return false;

  const msUntilEnd = endsAt.getTime() - now.getTime();
  if (msUntilEnd <= 0) return false;

  return msUntilEnd <= notifyBeforeMinutes * 60_000;
}
