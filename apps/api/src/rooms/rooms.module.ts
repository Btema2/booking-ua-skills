import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/auth.guard';
import { DrizzleRoomsRepository } from './drizzle-rooms.repository';
import { RoomsController } from './rooms.controller';
import { RoomsRepository } from './rooms.repository';

@Module({
  // AuthModule exports AuthService, which is all AuthGuard needs.
  imports: [AuthModule],
  controllers: [RoomsController],
  providers: [AuthGuard, { provide: RoomsRepository, useClass: DrizzleRoomsRepository }],
})
export class RoomsModule {}
