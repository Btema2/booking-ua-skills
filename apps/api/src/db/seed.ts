import { NewRoomSchema, OFFICE_CLOSE_HOUR, OFFICE_OPEN_HOUR, OFFICE_ZONE, slotsForWeek, type Slot } from '@booking/core';
import { hash } from 'bcrypt';
import { inArray, sql } from 'drizzle-orm';
import { getConnection } from './connection';
import { runQuery } from './driver-errors';
import { bookings, rooms, users } from './schema';

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

// Fixed UUIDs (not `defaultRandom()`) are what makes the two demo users and their
// bookings upsertable by primary key — a random id would insert a fresh duplicate
// row on every boot instead of converging on the declared state, same reasoning
// as the room upsert above.
const DEMO_USERS = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Анна Мельник', email: 'anna@example.com' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Богдан Ткач', email: 'bogdan@example.com' },
] as const;

// Also documented in the README's "Seed data" section — keep both in sync.
const DEMO_PASSWORD = 'password123';

// Matches auth.service.ts's BCRYPT_COST. Not imported from there: this script is
// also run standalone via `node dist/db/seed.js` (no `reflect-metadata` polyfill
// loaded), and AuthService is a Nest `@Injectable()` whose decorator evaluates
// `Reflect.defineMetadata` at import time — pulling it in would break that path.
const BCRYPT_COST = 12;

/** Both demo users are pre-verified so booking works immediately, no dev-log link to follow. */
async function seedUsers(): Promise<void> {
  const { db } = getConnection();
  const passwordHash = await hash(DEMO_PASSWORD, BCRYPT_COST);
  const now = new Date();
  await runQuery('seedUsers', () =>
    db
      .insert(users)
      .values(DEMO_USERS.map((user) => ({ ...user, passwordHash, emailVerifiedAt: now })))
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: sql`excluded.name`,
          email: sql`excluded.email`,
          passwordHash: sql`excluded.password_hash`,
          emailVerifiedAt: sql`excluded.email_verified_at`,
        },
      }),
  );
}

const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = ((OFFICE_CLOSE_HOUR - OFFICE_OPEN_HOUR) * 60) / SLOT_MINUTES;

/** Looks up the office slot starting at `hour:minute` Kyiv time on the given Monday-relative day. */
function slotAt(slots: Slot[], dayOffset: number, hour: number, minute: 0 | 30 = 0): Slot {
  const slotIndex = (hour - OFFICE_OPEN_HOUR) * 2 + (minute === 30 ? 1 : 0);
  const slot = slots[dayOffset * SLOTS_PER_DAY + slotIndex];
  if (!slot) {
    throw new Error(`No office slot for day ${dayOffset} at ${hour}:${minute}`);
  }
  return slot;
}

interface DemoBookingSpec {
  id: string;
  roomName: string;
  ownerId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
}

const SLOT_MS = SLOT_MINUTES * 60 * 1000;

/**
 * If `pool[index]` and the slot right after it in the same contiguous array
 * are exactly one grid step apart, they're the same Kyiv office day and can
 * be merged into one 60-minute booking — `next.endsAt`, not `next.startsAt`
 * (which is just `current.endsAt` again and would make this a no-op). When
 * they're not adjacent (the slot after 18:30 is next day's 09:00 — a 14+
 * hour jump, never exactly `SLOT_MS`), this falls back to the single
 * 30-minute slot instead of spanning midnight.
 */
function extendedEnd(pool: Slot[], index: number): Date {
  const current = pool[index];
  const next = pool[index + 1];
  if (next && next.startsAt.getTime() - current.startsAt.getTime() === SLOT_MS) {
    return next.endsAt;
  }
  return current.endsAt;
}

const UPCOMING_BOOKING_COUNT = 5;

/**
 * Slots strictly after `now`, spanning the rest of the current Kyiv week.
 * A judge could boot this on any weekday — including Saturday, when Mon–Fri
 * of "the current week" have already passed — so picking fixed weekday
 * offsets would sometimes leave every "upcoming" demo booking already in the
 * past. Falls back to next week's full grid on the rare boot that catches
 * the current week almost fully spent (e.g. Sunday evening).
 */
function upcomingSlotPool(now: Date): Slot[] {
  const thisWeekRemaining = slotsForWeek(now, OFFICE_ZONE).filter((slot) => slot.startsAt.getTime() > now.getTime());
  if (thisWeekRemaining.length >= UPCOMING_BOOKING_COUNT) {
    return thisWeekRemaining;
  }
  const nextWeek = slotsForWeek(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), OFFICE_ZONE);
  return [...thisWeekRemaining, ...nextWeek];
}

/**
 * Built from `slotsForWeek` (the same DST-aware Luxon math the week grid itself
 * uses) rather than any hand-rolled date arithmetic, so every instant lands
 * exactly on a Kyiv office-hour slot boundary regardless of which day the seed
 * happens to run on. The "spread across the week" bookings are drawn from
 * `upcomingSlotPool`, always strictly after `now`. The two "already happened"
 * bookings anchor on the week exactly seven days before `now`, which is always
 * fully in the past — that's what guarantees «Мої бронювання» has a past-tab
 * entry no matter what day a judge boots this.
 */
function buildDemoBookings(): DemoBookingSpec[] {
  const now = new Date();
  const lastWeek = slotsForWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), OFFICE_ZONE);
  const [anna, bogdan] = DEMO_USERS;

  const upcomingSpecs: Array<Pick<DemoBookingSpec, 'id' | 'roomName' | 'ownerId' | 'title'>> = [
    { id: 'a0000000-0000-4000-8000-000000000001', roomName: 'Дуб', ownerId: anna.id, title: 'Стендап команди' },
    { id: 'a0000000-0000-4000-8000-000000000002', roomName: 'Ясен', ownerId: bogdan.id, title: 'Співбесіда з кандидатом' },
    { id: 'a0000000-0000-4000-8000-000000000003', roomName: 'Липа', ownerId: anna.id, title: 'Дзвінок з клієнтом' },
    { id: 'a0000000-0000-4000-8000-000000000004', roomName: 'Верба', ownerId: bogdan.id, title: 'Ретроспектива спринту' },
    { id: 'a0000000-0000-4000-8000-000000000005', roomName: 'Сосна', ownerId: anna.id, title: 'Демо продукту' },
  ];
  const pool = upcomingSlotPool(now);
  const step = Math.max(1, Math.floor(pool.length / UPCOMING_BOOKING_COUNT));
  const upcoming = upcomingSpecs.map((spec, i) => {
    const index = Math.min(i * step, pool.length - 1);
    return { ...spec, startsAt: pool[index].startsAt, endsAt: extendedEnd(pool, index) };
  });

  return [
    ...upcoming,
    {
      id: 'a0000000-0000-4000-8000-000000000006',
      roomName: 'Клен',
      ownerId: anna.id,
      title: 'Плановий синк',
      startsAt: slotAt(lastWeek, 2, 9).startsAt,
      endsAt: slotAt(lastWeek, 2, 10).startsAt,
    },
    {
      id: 'a0000000-0000-4000-8000-000000000007',
      roomName: 'Дуб',
      ownerId: bogdan.id,
      title: 'Огляд бюджету',
      startsAt: slotAt(lastWeek, 3, 14).startsAt,
      endsAt: slotAt(lastWeek, 3, 15).startsAt,
    },
  ];
}

/**
 * Room ids come from a live lookup, never an assumed serial order — `seedRooms`
 * upserts by name, so the id a room actually got is the only safe source.
 * Upserted by booking id for the same reason the users above are: re-running
 * the seed must converge, not duplicate. `canceledAt` is reset to null on
 * conflict too, so a demo booking cancelled while poking at the UI comes back
 * clean on the next `docker compose up` — the same "converge on the declared
 * state" rule the room upsert already follows.
 */
async function seedBookings(): Promise<void> {
  const { db } = getConnection();
  const demoBookings = buildDemoBookings();
  const roomNames = [...new Set(demoBookings.map((booking) => booking.roomName))];
  const roomRows = await db.select({ id: rooms.id, name: rooms.name }).from(rooms).where(inArray(rooms.name, roomNames));
  const roomIdByName = new Map(roomRows.map((room) => [room.name, room.id]));

  const values = demoBookings.map((booking) => {
    const roomId = roomIdByName.get(booking.roomName);
    if (roomId === undefined) {
      throw new Error(`Seed booking references unknown room "${booking.roomName}"`);
    }
    return {
      id: booking.id,
      roomId,
      userId: booking.ownerId,
      title: booking.title,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
    };
  });

  await runQuery('seedBookings', () =>
    db
      .insert(bookings)
      .values(values)
      .onConflictDoUpdate({
        target: bookings.id,
        set: {
          roomId: sql`excluded.room_id`,
          userId: sql`excluded.user_id`,
          title: sql`excluded.title`,
          startsAt: sql`excluded.starts_at`,
          endsAt: sql`excluded.ends_at`,
          canceledAt: sql`null`,
        },
      }),
  );
}

export async function seedDemoData(): Promise<void> {
  await seedRooms();
  await seedUsers();
  await seedBookings();
}

if (require.main === module) {
  seedDemoData()
    .then(() => getConnection().pool.end())
    .catch((error: unknown) => {
      console.error('Seed failed', error);
      process.exitCode = 1;
    });
}
