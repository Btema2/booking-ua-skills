import { shouldNotifyBookingEnding } from '@booking/core';
import { Injectable } from '@nestjs/common';
import { loadEnv } from '../config/env';
import { notificationNotFound } from './notifications.errors';
import { ENDING_SOON_KIND, NotificationsRepository, type NotificationRow } from './notifications.repository';

const NOTIFICATIONS_LIST_LIMIT = 20;

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationsRepo: NotificationsRepository) {}

  /**
   * One scheduler pass: finds live bookings ending inside the notify window,
   * checks whether each room's next slot is already taken, and inserts at
   * most one notification per booking. `now` is a parameter rather than
   * `new Date()` so both the real scheduler and tests can drive it — the
   * notifications_once unique index is what actually guarantees "exactly
   * once", so a repeated tick over the same booking is a safe no-op here.
   */
  async tick(now: Date = new Date()): Promise<number> {
    const { NOTIFY_BEFORE_MINUTES } = loadEnv();
    const candidates = await this.notificationsRepo.findEndingSoonCandidates(now, NOTIFY_BEFORE_MINUTES);

    let created = 0;
    for (const candidate of candidates) {
      const isNextSlotTaken = await this.notificationsRepo.isNextSlotTaken(candidate.roomId, candidate.endsAt);
      const shouldNotify = shouldNotifyBookingEnding({
        now,
        endsAt: candidate.endsAt,
        notifyBeforeMinutes: NOTIFY_BEFORE_MINUTES,
        isNextSlotTaken,
      });
      if (!shouldNotify) continue;

      const inserted = await this.notificationsRepo.createIfNotExists({
        userId: candidate.userId,
        bookingId: candidate.id,
        kind: ENDING_SOON_KIND,
      });
      if (inserted) created++;
    }
    return created;
  }

  // `notifyBeforeMinutes` rides along so the client can interpolate it into the
  // "N хв" text without hardcoding it — the row itself never stores rendered text.
  async listMine(userId: string): Promise<{ notifications: NotificationRow[]; notifyBeforeMinutes: number }> {
    const { NOTIFY_BEFORE_MINUTES } = loadEnv();
    const notifications = await this.notificationsRepo.listForUser(userId, NOTIFICATIONS_LIST_LIMIT);
    return { notifications, notifyBeforeMinutes: NOTIFY_BEFORE_MINUTES };
  }

  async markRead(id: string, userId: string): Promise<void> {
    const marked = await this.notificationsRepo.markRead(id, userId);
    if (!marked) {
      throw notificationNotFound();
    }
  }
}
