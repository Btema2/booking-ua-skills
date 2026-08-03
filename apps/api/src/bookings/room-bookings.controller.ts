import { RoomBookingsQuerySchema, RoomIdPathSchema } from '@booking/core';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { parseOrThrow } from '../common/parse-or-throw';
import { BookingsService } from './bookings.service';
import type { BookingRow } from './bookings.repository';

// The room-id rule itself lives in @booking/core, so the int4 ceiling and its
// Ukrainian message are not restated here.
const RoomIdParamSchema = z.object({ roomId: RoomIdPathSchema });

// Lives in the bookings module rather than the rooms module, so RoomsModule
// keeps no dependency on booking concepts.
@Controller('api/rooms/:roomId/bookings')
@UseGuards(AuthGuard)
export class RoomBookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  async list(@Param() params: unknown, @Query() query: unknown): Promise<{ bookings: BookingRow[] }> {
    const { roomId } = parseOrThrow(RoomIdParamSchema, params);
    const { from, to } = parseOrThrow(RoomBookingsQuerySchema, query);
    return { bookings: await this.bookings.listForRoom(roomId, from, to) };
  }
}
