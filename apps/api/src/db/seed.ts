import { NewRoomSchema } from '@booking/core';
import { getConnection } from './connection';
import { rooms } from './schema';

const ROOM_SEED = NewRoomSchema.array().parse([
  { name: 'Дуб', floor: 1, capacity: 4 },
  { name: 'Ясен', floor: 1, capacity: 6 },
  { name: 'Липа', floor: 2, capacity: 8 },
  { name: 'Верба', floor: 2, capacity: 4 },
  { name: 'Сосна', floor: 3, capacity: 10 },
  { name: 'Клен', floor: 3, capacity: 2 },
]);

export async function seedRooms(): Promise<void> {
  const { db } = getConnection();
  await db.insert(rooms).values(ROOM_SEED).onConflictDoNothing({ target: rooms.name });
}

if (require.main === module) {
  seedRooms()
    .then(() => getConnection().pool.end())
    .catch((error: unknown) => {
      console.error('Seed failed', error);
      process.exitCode = 1;
    });
}
