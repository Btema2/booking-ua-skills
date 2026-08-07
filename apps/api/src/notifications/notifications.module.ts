import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/auth.guard';
import { DrizzleNotificationsRepository } from './drizzle-notifications.repository';
import { NotificationScheduler } from './notification-scheduler.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

@Module({
  // AuthModule exports AuthService, which is all AuthGuard needs.
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    AuthGuard,
    NotificationsService,
    NotificationScheduler,
    { provide: NotificationsRepository, useClass: DrizzleNotificationsRepository },
  ],
  exports: [NotificationsRepository],
})
export class NotificationsModule {}
