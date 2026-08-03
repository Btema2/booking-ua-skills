import { NewRoomSchema } from '@booking/core';
import { sql } from 'drizzle-orm';
import { getConnection } from './connection';
import { rooms } from './schema';

// Floor, capacity and amenities are the prototype's own room table, copied as-is
// so the seeded data and the design agree — including Клен, whose note the handoff
// gives but which the UI must still render when a room has none.
const ROOM_SEED = NewRoomSchema.array().parse([
  { name: 'Дуб', floor: 2, capacity: 12, amenities: 'Проєктор, маркерна дошка' },
  { name: 'Ясен', floor: 2, capacity: 8, amenities: 'ТВ 55", вебкамера' },
  { name: 'Липа', floor: 3, capacity: 4, amenities: 'Тиха кімната для дзвінків' },
  { name: 'Верба', floor: 3, capacity: 6, amenities: 'ТВ, фліпчарт' },
  { name: 'Сосна', floor: 4, capacity: 16, amenities: 'Конференц-звук, трансляція' },
  { name: 'Клен', floor: 4, capacity: 4, amenities: 'Фокус-кімната' },
]);

/**
 * Upsert rather than insert-or-ignore. Both are idempotent — `rooms_name_unique`
 * means a second run can neither duplicate nor fail — but ignoring the conflict
 * would leave an existing database on whatever capacities it was first seeded
 * with, so changing the table above would only reach a volume created after the
 * change. Updating on conflict makes the seed converge on the declared state.
 */
export async function seedRooms(): Promise<void> {
  const { db } = getConnection();
  await db
    .insert(rooms)
    .values(ROOM_SEED)
    .onConflictDoUpdate({
      target: rooms.name,
      set: {
        floor: sql`excluded.floor`,
        capacity: sql`excluded.capacity`,
        amenities: sql`excluded.amenities`,
      },
    });
}

if (require.main === module) {
  seedRooms()
    .then(() => getConnection().pool.end())
    .catch((error: unknown) => {
      console.error('Seed failed', error);
      process.exitCode = 1;
    });
}
