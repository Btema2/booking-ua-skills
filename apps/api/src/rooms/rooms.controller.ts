import { RoomListQuerySchema } from '@booking/core';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { parseOrThrow } from '../common/parse-or-throw';
import { RoomsRepository, type RoomRow } from './rooms.repository';

@Controller('api/rooms')
@UseGuards(AuthGuard)
export class RoomsController {
  constructor(private readonly rooms: RoomsRepository) {}

  @Get()
  async list(@Query() query: unknown): Promise<{ rooms: RoomRow[] }> {
    const { minCapacity } = parseOrThrow(RoomListQuerySchema, query);
    return { rooms: await this.rooms.listRooms(minCapacity) };
  }
}
