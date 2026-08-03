import { Injectable } from '@nestjs/common';
import { asc, gte } from 'drizzle-orm';
import { getConnection } from '../db/connection';
import { runQuery } from '../db/driver-errors';
import { rooms } from '../db/schema';
import { RoomsRepository, type RoomRow } from './rooms.repository';

const ROOM_COLUMNS = {
  id: rooms.id,
  name: rooms.name,
  floor: rooms.floor,
  capacity: rooms.capacity,
  amenities: rooms.amenities,
} as const;

@Injectable()
export class DrizzleRoomsRepository extends RoomsRepository {
  // Resolved per call so building the module never opens a connection pool.
  private get db() {
    return getConnection().db;
  }

  async listRooms(minCapacity?: number): Promise<RoomRow[]> {
    // Drizzle drops a `where` of undefined, which is exactly "no filter".
    const condition = minCapacity === undefined ? undefined : gte(rooms.capacity, minCapacity);
    return runQuery('listRooms', () =>
      this.db.select(ROOM_COLUMNS).from(rooms).where(condition).orderBy(asc(rooms.floor), asc(rooms.name)),
    );
  }
}
