import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/auth.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsController } from './bookings.controller';
import { BookingsRepository } from './bookings.repository';
import { BookingsService } from './bookings.service';
import { DrizzleBookingsRepository } from './drizzle-bookings.repository';
import { RoomBookingsController } from './room-bookings.controller';

@Module({
  // AuthModule exports AuthService, which is all AuthGuard needs.
  imports: [AuthModule, NotificationsModule],
  controllers: [BookingsController, RoomBookingsController],
  providers: [AuthGuard, BookingsService, { provide: BookingsRepository, useClass: DrizzleBookingsRepository }],
})
export class BookingsModule {}
