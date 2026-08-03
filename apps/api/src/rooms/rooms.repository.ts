export interface RoomRow {
  id: number;
  name: string;
  floor: number;
  capacity: number;
  amenities: string | null;
}

/**
 * Persistence boundary for rooms. Abstract class so it doubles as a Nest DI
 * token: production binds the Drizzle implementation, specs bind a double and
 * never touch Postgres.
 */
export abstract class RoomsRepository {
  /** Ordered by floor, then name. `minCapacity` undefined means no filter. */
  abstract listRooms(minCapacity?: number): Promise<RoomRow[]>;
}
