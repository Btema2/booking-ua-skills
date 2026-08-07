export const ENDING_SOON_KIND = 'ending_soon';

/** A live booking whose `endsAt` falls inside the scheduler's lookahead window. */
export interface EndingSoonCandidate {
  id: string;
  roomId: number;
  userId: string;
  endsAt: Date;
}

export interface NewNotification {
  userId: string;
  bookingId: string;
  kind: string;
}

/** Enough to render the notification text without persisting it. */
export interface NotificationRow {
  id: string;
  bookingId: string | null;
  kind: string;
  message: string | null;
  createdAt: Date;
  readAt: Date | null;
  bookingTitle: string | null;
  bookingEndsAt: Date | null;
  roomId: number | null;
  roomName: string | null;
}

/**
 * Persistence boundary for notifications. Abstract class so it doubles as a
 * Nest DI token, the same shape as `BookingsRepository`.
 */
export abstract class NotificationsRepository {
  /** Live bookings ending inside `(now, now + notifyBeforeMinutes]`. */
  abstract findEndingSoonCandidates(now: Date, notifyBeforeMinutes: number): Promise<EndingSoonCandidate[]>;
  /** Whether a live booking already starts exactly at `instant` in `roomId`. */
  abstract isNextSlotTaken(roomId: number, instant: Date): Promise<boolean>;
  /** Idempotent at the database level via the `notifications_once` unique index. Returns whether it inserted a new row. */
  abstract createIfNotExists(input: NewNotification): Promise<boolean>;
  /** Inserts a notification for recurring series creation with skipped dates due to conflict. */
  abstract createConflictNotification(userId: string, message: string): Promise<boolean>;
  /** Most recent notifications for a user, unread first. */
  abstract listForUser(userId: string, limit: number): Promise<NotificationRow[]>;
  /** Returns false if no notification with that id belongs to the user. */
  abstract markRead(id: string, userId: string): Promise<boolean>;
}
