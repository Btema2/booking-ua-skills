import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

// Well under the smallest sane NOTIFY_BEFORE_MINUTES (SPEC's own default is 10
// minutes), so no booking's notify window can pass entirely between two ticks.
const TICK_INTERVAL_MS = 30_000;

@Injectable()
export class NotificationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationScheduler.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly notifications: NotificationsService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.notifications.tick().catch((error: unknown) => this.logger.error('Notification tick failed', error));
    }, TICK_INTERVAL_MS);
    // Never keeps the process (or a Jest run) alive on its own.
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }
}
