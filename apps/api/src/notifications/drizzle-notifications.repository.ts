import { Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, lte, sql } from 'drizzle-orm';
import { getConnection } from '../db/connection';
import { runQuery } from '../db/driver-errors';
import { bookings, notifications, rooms } from '../db/schema';
import {
  NotificationsRepository,
  type EndingSoonCandidate,
  type NewNotification,
  type NotificationRow,
} from './notifications.repository';

@Injectable()
export class DrizzleNotificationsRepository extends NotificationsRepository {
  private get db() {
    return getConnection().db;
  }

  async findEndingSoonCandidates(now: Date, notifyBeforeMinutes: number): Promise<EndingSoonCandidate[]> {
    const windowEnd = new Date(now.getTime() + notifyBeforeMinutes * 60_000);
    return runQuery('findEndingSoonCandidates', () =>
      this.db
        .select({ id: bookings.id, roomId: bookings.roomId, userId: bookings.userId, endsAt: bookings.endsAt })
        .from(bookings)
        .where(and(isNull(bookings.canceledAt), gt(bookings.endsAt, now), lte(bookings.endsAt, windowEnd))),
    );
  }

  async isNextSlotTaken(roomId: number, instant: Date): Promise<boolean> {
    const rows = await runQuery('isNextSlotTaken', () =>
      this.db
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.roomId, roomId), eq(bookings.startsAt, instant), isNull(bookings.canceledAt)))
        .limit(1),
    );
    return rows.length > 0;
  }

  async createIfNotExists(input: NewNotification): Promise<boolean> {
    const inserted = await runQuery('createNotificationIfNotExists', () =>
      this.db
        .insert(notifications)
        .values({ userId: input.userId, bookingId: input.bookingId, kind: input.kind })
        .onConflictDoNothing({ target: [notifications.bookingId, notifications.kind] })
        .returning({ id: notifications.id }),
    );
    return inserted.length > 0;
  }

  async createConflictNotification(userId: string, message: string): Promise<boolean> {
    const inserted = await runQuery('createConflictNotification', () =>
      this.db
        .insert(notifications)
        .values({ userId, kind: 'series_conflict', message })
        .returning({ id: notifications.id }),
    );
    return inserted.length > 0;
  }

  async listForUser(userId: string, limit: number): Promise<NotificationRow[]> {
    return runQuery('listNotificationsForUser', () =>
      this.db
        .select({
          id: notifications.id,
          bookingId: notifications.bookingId,
          kind: notifications.kind,
          message: notifications.message,
          createdAt: notifications.createdAt,
          readAt: notifications.readAt,
          bookingTitle: bookings.title,
          bookingEndsAt: bookings.endsAt,
          roomId: rooms.id,
          roomName: rooms.name,
        })
        .from(notifications)
        .leftJoin(bookings, eq(bookings.id, notifications.bookingId))
        .leftJoin(rooms, eq(rooms.id, bookings.roomId))
        .where(eq(notifications.userId, userId))
        // Unread first, then most recent — matches the "Unread + recent" contract in SPEC §4.
        .orderBy(desc(sql`${notifications.readAt} is null`), desc(notifications.createdAt))
        .limit(limit),
    );
  }

  async markRead(id: string, userId: string): Promise<boolean> {
    const updated = await runQuery('markNotificationRead', () =>
      this.db
        .update(notifications)
        .set({ readAt: sql`now()` })
        .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
        .returning({ id: notifications.id }),
    );
    return updated.length > 0;
  }
}
