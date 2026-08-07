# Weekly Recurring Bookings (Phase 8.4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user create a weekly-recurring booking (e.g. "every Tuesday, 8 occurrences") and cancel either one occurrence or the whole series, without touching the existing single-booking create/cancel paths or the `bookings_no_overlap` EXCLUDE constraint.

**Architecture:** A thin `booking_series` grouping table plus a nullable `bookings.series_id` column. Series creation loops the *existing* `createBooking` insert path once per occurrence (so it inherits the existing race-safe EXCLUDE-constraint handling verbatim), collecting successes and per-occurrence `SlotTakenError` conflicts into a partial-success result. Occurrence dates are computed by a new pure, DST-safe `weeklyOccurrences` function in `packages/core` — never inline date arithmetic in the service or repository.

**Tech Stack:** NestJS 11 / Drizzle 0.45.2 / Zod 4 (API), React 19 / React Hook Form / TanStack Query (web), Luxon 3 (timezone math), Jest (API unit + integration), Vitest (core + web unit).

## Global Constraints

- Node 24. TypeScript 5.9.3. `drizzle-orm@0.45.2` / `drizzle-kit@0.31.10`, exact versions, never `^`.
- **Never run `drizzle-kit push`.** Generate with `drizzle-kit generate`, commit the SQL under `apps/api/drizzle/`, apply via the existing programmatic `migrate()` at process start.
- All timestamps stored and computed in UTC. Never hardcode Kyiv's `+2`/`+3` offset — always derive it from Luxon against the specific instant (`Europe/Kyiv` zone), because Kyiv's offset changes on EU DST dates that don't necessarily match the viewer's own DST dates.
- UI strings Ukrainian. Code, identifiers, comments, commit messages English.
- Every route lives in its feature module (`BookingsModule`), never a root `controllers` array.
- `npm test` (root) must stay green with Docker **stopped** at every commit in this plan — it must never import `getConnection` or otherwise require a live database. Only `*.int-spec.ts` under `apps/api/test/` may touch Postgres, and only `npm run test:integration` runs those.
- Every env var read in code must appear in `.env.example` in both directions — not touched by this plan, since no new env var is introduced.
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, ...), small and meaningful, one per task step group as marked below.
- Do not edit `BookingsService.create`, `BookingsService.cancel`, or the `0005_bookings_no_overlap.sql` migration. Every change in this plan is additive: new files, new optional fields with no default-breaking existing callers, new methods alongside existing ones.

---

## File Structure

**New files:**
- `packages/core/src/domain/weekly-occurrences.ts` — pure occurrence-date generator.
- `packages/core/src/domain/weekly-occurrences.test.ts`
- `apps/api/drizzle/00XX_<generated>.sql` — migration (name assigned by `drizzle-kit generate`).
- `apps/web/src/features/bookings/CancelBookingDialog.test.tsx` — first test file for this component.

**Modified files (in the order this plan touches them):**
- `packages/core/src/schemas/booking.ts` — `BookingSchema.seriesId`, new `CreateBookingSeriesSchema`.
- `packages/core/src/schemas/booking.test.ts` — cover the new field/schema; fix the one existing exact-match test that the new required field breaks.
- `packages/core/src/domain/index.ts`, `packages/core/src/index.ts` — export the new function/schema.
- `apps/api/src/db/schema.ts` — `bookingSeries` table, `bookings.seriesId` column.
- `apps/api/src/bookings/bookings.repository.ts` — interface additions.
- `apps/api/src/bookings/drizzle-bookings.repository.ts` — implementation.
- `apps/api/src/bookings/drizzle-bookings.repository.spec.ts` — add `seriesId` to the existing fixture row.
- `apps/api/src/bookings/bookings.errors.ts` — two new error builders.
- `apps/api/src/bookings/bookings.service.ts` — `createSeries`, `cancelSeries`.
- `apps/api/src/bookings/bookings.service.spec.ts` — add `seriesId` to `VALID_ROW`; new `describe` blocks.
- `apps/api/src/bookings/bookings.controller.ts` — `POST /api/bookings/series`, `?scope=series` on `DELETE`.
- `apps/api/src/bookings/bookings.controller.spec.ts` — update `RecordingBookingsRepository`; new `describe` blocks.
- `apps/api/test/bookings.int-spec.ts` — series create/cancel integration coverage.
- `apps/web/src/lib/api.ts` — no change (existing `postJson`/`apiRequest` are already generic enough).
- `apps/web/src/features/bookings/useBookingMutations.ts` — `useCreateBookingSeries`, `scope` param on `useCancelBooking`.
- `apps/web/src/features/bookings/CreateBookingModal.tsx` — repeat toggle + occurrence count.
- `apps/web/src/features/bookings/CreateBookingModal.test.tsx` — cover the new toggle.
- `apps/web/src/features/bookings/CancelBookingDialog.tsx` — this-vs-series radio.
- `apps/web/src/features/rooms/RoomSchedulePage.tsx` — wire both up.

---

### Task 0: Baseline — capture pre-change test counts, create the branch

**Files:** none (verification + git only).

- [ ] **Step 1: Confirm the working tree is clean and on `main`**

Run: `git status` and `git log --oneline -3`
Expected: `nothing to commit, working tree clean`, `HEAD` is the design-doc commit (or later) on `main`.

- [ ] **Step 2: Record baseline unit test counts (Docker stopped)**

Run: `npm test`
Expected: all workspaces pass (core vitest, web vitest, api `tsc --noEmit` + jest). Write down the jest suite/test counts printed for `apps/api` (e.g. "Test Suites: N passed", "Tests: M passed") — these are the numbers Task 12 must still show at minimum.

- [ ] **Step 3: Record baseline integration test count (Docker running)**

Run: `docker compose up -d` then `npm run test:integration`
Expected: 19 passing tests (per the existing `bookings.int-spec.ts` plus `notifications.int-spec.ts`). Write down the exact count.
Run: `docker compose down` afterward to leave the machine as found.

- [ ] **Step 4: Create the feature branch**

```bash
git checkout -b phase-8-4-recurring-bookings
```

---

### Task 1: `weeklyOccurrences` — pure, DST-safe occurrence generator

**Files:**
- Create: `packages/core/src/domain/weekly-occurrences.ts`
- Test: `packages/core/src/domain/weekly-occurrences.test.ts`

**Interfaces:**
- Produces: `weeklyOccurrences(firstStart: Date, firstEnd: Date, count: number): { startsAt: Date; endsAt: Date }[]` — consumed by `BookingsService.createSeries` in Task 5.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/domain/weekly-occurrences.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { weeklyOccurrences } from './weekly-occurrences';

describe('weeklyOccurrences', () => {
  it('generates `count` occurrences, one week apart in UTC when no DST boundary is crossed', () => {
    const firstStart = new Date('2026-01-06T07:00:00.000Z'); // Tuesday 09:00 Kyiv, winter (+2)
    const firstEnd = new Date('2026-01-06T08:00:00.000Z');

    const result = weeklyOccurrences(firstStart, firstEnd, 3);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ startsAt: firstStart, endsAt: firstEnd });
    expect(result[1].startsAt.getTime() - result[0].startsAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(result[2].startsAt.getTime() - result[1].startsAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('keeps the Kyiv wall-clock time identical across the last-Sunday-of-March DST transition', () => {
    // 2026-03-29 is the last Sunday of March 2026 (Kyiv's spring-forward,
    // EET +2 -> EEST +3). Tuesday 2026-03-24 is the occurrence right before
    // it, so occurrence 2 of 4 (2026-03-31) lands after the transition.
    const firstStart = new Date('2026-03-24T07:00:00.000Z'); // 09:00 Kyiv (EET, +2)
    const firstEnd = new Date('2026-03-24T08:00:00.000Z'); // 10:00 Kyiv

    const result = weeklyOccurrences(firstStart, firstEnd, 4);

    for (const occurrence of result) {
      const kyivStart = DateTime.fromJSDate(occurrence.startsAt, { zone: 'utc' }).setZone('Europe/Kyiv');
      const kyivEnd = DateTime.fromJSDate(occurrence.endsAt, { zone: 'utc' }).setZone('Europe/Kyiv');
      expect(kyivStart.toFormat('HH:mm')).toBe('09:00');
      expect(kyivEnd.toFormat('HH:mm')).toBe('10:00');
    }

    // Naive `+7 days` UTC arithmetic would keep every gap at exactly 168h.
    // The gap spanning the DST transition must be 167h instead, because
    // Kyiv loses an hour that week (EET -> EEST) — proof the function
    // anchors to Kyiv wall-clock time, not to a fixed UTC offset.
    const gapsHours = result.slice(1).map((occ, i) => (occ.startsAt.getTime() - result[i].startsAt.getTime()) / (60 * 60 * 1000));
    expect(gapsHours).toContain(167);
    expect(gapsHours.every((h) => h === 168)).toBe(false);
  });

  it("returns exactly `count` occurrences for the brief's own example (8)", () => {
    const firstStart = new Date('2026-01-06T07:00:00.000Z');
    const firstEnd = new Date('2026-01-06T08:00:00.000Z');

    expect(weeklyOccurrences(firstStart, firstEnd, 8)).toHaveLength(8);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/core/src/domain/weekly-occurrences.test.ts` (from repo root, or `cd packages/core && npx vitest run src/domain/weekly-occurrences.test.ts`)
Expected: FAIL — `Cannot find module './weekly-occurrences'` (the file doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `packages/core/src/domain/weekly-occurrences.ts`:

```ts
import { DateTime } from 'luxon';
import { OFFICE_ZONE } from './office-hours';

/**
 * Generates `count` weekly occurrences starting from occurrence 1
 * (`firstStart`/`firstEnd`). Anchors to the Kyiv **wall-clock** time via
 * Luxon `.plus({ weeks })` in the `Europe/Kyiv` zone, then converts back to
 * UTC per occurrence — never `+7×24h` on the raw UTC instant. A series can
 * span two months, long enough to cross a Kyiv DST boundary (last Sunday of
 * March or October); naive UTC arithmetic would silently shift every
 * occurrence after the boundary by an hour of Kyiv wall-clock time.
 */
export function weeklyOccurrences(
  firstStart: Date,
  firstEnd: Date,
  count: number,
): { startsAt: Date; endsAt: Date }[] {
  const kyivStart = DateTime.fromJSDate(firstStart, { zone: 'utc' }).setZone(OFFICE_ZONE);
  const kyivEnd = DateTime.fromJSDate(firstEnd, { zone: 'utc' }).setZone(OFFICE_ZONE);

  const occurrences: { startsAt: Date; endsAt: Date }[] = [];
  for (let n = 0; n < count; n += 1) {
    occurrences.push({
      startsAt: kyivStart.plus({ weeks: n }).toUTC().toJSDate(),
      endsAt: kyivEnd.plus({ weeks: n }).toUTC().toJSDate(),
    });
  }
  return occurrences;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/core/src/domain/weekly-occurrences.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Export it and run the full core suite**

Edit `packages/core/src/domain/index.ts`, add:

```ts
export { weeklyOccurrences } from './weekly-occurrences';
```

Edit `packages/core/src/index.ts`, in the `from './domain'` export block add `weeklyOccurrences` to the named list (alongside `overlaps`, `isAligned`, etc.).

Run: `cd packages/core && npx vitest run`
Expected: PASS, all existing core tests still green plus the 3 new ones.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain/weekly-occurrences.ts packages/core/src/domain/weekly-occurrences.test.ts packages/core/src/domain/index.ts packages/core/src/index.ts
git commit -m "feat(core): add DST-safe weeklyOccurrences domain function"
```

---

### Task 2: `CreateBookingSeriesSchema` and `BookingSchema.seriesId`

**Files:**
- Modify: `packages/core/src/schemas/booking.ts`
- Modify: `packages/core/src/schemas/booking.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `CreateBookingSeriesSchema`, `type CreateBookingSeriesInput`, `MIN_OCCURRENCE_COUNT`, `MAX_OCCURRENCE_COUNT` — consumed by the API controller (Task 6) and the frontend modal (Task 9). `BookingSchema` now includes `seriesId: string | null` — consumed by the frontend cancel dialog (Task 10).

- [ ] **Step 1: Write the failing tests**

Edit `packages/core/src/schemas/booking.test.ts`. First, fix the existing exact-match test so it accounts for the new required field — change the `BookingSchema` `describe` block's first test:

```ts
describe('BookingSchema', () => {
  it('parses what the API returns for one booking', () => {
    const payload = {
      id: '3f7b1c2e-4b2a-4c1a-9e2a-8a2b1c3d4e5f',
      roomId: 1,
      title: 'Нарада',
      startsAt: new Date('2026-01-07T07:00:00.000Z'),
      endsAt: new Date('2026-01-07T08:00:00.000Z'),
      userId: '1a2b3c4d-5e6f-4789-8a9b-0c1d2e3f4a5b',
      userName: 'Іван Петренко',
      seriesId: null,
    };

    expect(BookingSchema.parse(payload)).toEqual(payload);
  });

  it('parses a booking that belongs to a series', () => {
    const payload = {
      id: '3f7b1c2e-4b2a-4c1a-9e2a-8a2b1c3d4e5f',
      roomId: 1,
      title: 'Нарада',
      startsAt: new Date('2026-01-07T07:00:00.000Z'),
      endsAt: new Date('2026-01-07T08:00:00.000Z'),
      userId: '1a2b3c4d-5e6f-4789-8a9b-0c1d2e3f4a5b',
      userName: 'Іван Петренко',
      seriesId: '4a5b6c7d-8e9f-4a1b-9c2d-3e4f5a6b7c8d',
    };

    expect(BookingSchema.parse(payload)).toEqual(payload);
  });

  it('rejects a non-uuid id', () => {
    expect(
      BookingSchema.safeParse({
        id: 'not-a-uuid',
        roomId: 1,
        title: 'Нарада',
        startsAt: new Date(),
        endsAt: new Date(),
        userId: '1a2b3c4d-5e6f-4789-8a9b-0c1d2e3f4a5b',
        userName: 'Іван',
        seriesId: null,
      }).success,
    ).toBe(false);
  });
});
```

Then add a new `describe` block at the end of the file, before the final blank line:

```ts
describe('CreateBookingSeriesSchema', () => {
  it('parses a valid series payload', () => {
    const parsed = CreateBookingSeriesSchema.parse({
      roomId: 1,
      title: 'Щотижневий синк',
      startsAt: '2026-01-06T07:00:00.000Z',
      endsAt: '2026-01-06T08:00:00.000Z',
      occurrenceCount: 8,
    });

    expect(parsed.occurrenceCount).toBe(8);
    expect(parsed.startsAt).toBeInstanceOf(Date);
  });

  it('rejects an occurrence count of 1 — a series needs at least 2 occurrences', () => {
    const result = CreateBookingSeriesSchema.safeParse({
      roomId: 1,
      title: 'Синк',
      startsAt: '2026-01-06T07:00:00.000Z',
      endsAt: '2026-01-06T08:00:00.000Z',
      occurrenceCount: 1,
    });

    expect(result.success).toBe(false);
  });

  it(`accepts the minimum occurrence count (${MIN_OCCURRENCE_COUNT})`, () => {
    const result = CreateBookingSeriesSchema.safeParse({
      roomId: 1,
      title: 'Синк',
      startsAt: '2026-01-06T07:00:00.000Z',
      endsAt: '2026-01-06T08:00:00.000Z',
      occurrenceCount: MIN_OCCURRENCE_COUNT,
    });

    expect(result.success).toBe(true);
  });

  it(`accepts the maximum occurrence count (${MAX_OCCURRENCE_COUNT})`, () => {
    const result = CreateBookingSeriesSchema.safeParse({
      roomId: 1,
      title: 'Синк',
      startsAt: '2026-01-06T07:00:00.000Z',
      endsAt: '2026-01-06T08:00:00.000Z',
      occurrenceCount: MAX_OCCURRENCE_COUNT,
    });

    expect(result.success).toBe(true);
  });

  it(`rejects an occurrence count over ${MAX_OCCURRENCE_COUNT}`, () => {
    const result = CreateBookingSeriesSchema.safeParse({
      roomId: 1,
      title: 'Синк',
      startsAt: '2026-01-06T07:00:00.000Z',
      endsAt: '2026-01-06T08:00:00.000Z',
      occurrenceCount: MAX_OCCURRENCE_COUNT + 1,
    });

    expect(result.success).toBe(false);
  });

  it('reuses the shared title rule (empty title rejected)', () => {
    const result = CreateBookingSeriesSchema.safeParse({
      roomId: 1,
      title: '',
      startsAt: '2026-01-06T07:00:00.000Z',
      endsAt: '2026-01-06T08:00:00.000Z',
      occurrenceCount: 8,
    });

    expect(result.success).toBe(false);
  });
});
```

Update the file's import line to add the new names:

```ts
import { BookingSchema, CreateBookingSchema, CreateBookingSeriesSchema, MAX_OCCURRENCE_COUNT, MIN_OCCURRENCE_COUNT, MyBookingsQuerySchema, RoomBookingsQuerySchema, RoomIdPathSchema } from './booking';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/core && npx vitest run src/schemas/booking.test.ts`
Expected: FAIL — `CreateBookingSeriesSchema` / `MIN_OCCURRENCE_COUNT` / `MAX_OCCURRENCE_COUNT` are not exported yet, and the two updated `BookingSchema` tests fail because `seriesId` isn't part of the schema (extra key on input is fine for the parse tests since `z.object` strips unknown keys by default — but the "series" test's `seriesId` will be silently stripped, so `toEqual(payload)` fails since the parsed value lacks the key the raw payload has).

- [ ] **Step 3: Write the minimal implementation**

Edit `packages/core/src/schemas/booking.ts`. Add `seriesId` to `BookingSchema`:

```ts
export const BookingSchema = z.object({
  id: z.uuid(),
  roomId: z.number().int().positive(),
  title: z.string(),
  startsAt: z.date(),
  endsAt: z.date(),
  userId: z.uuid(),
  userName: z.string(),
  seriesId: z.uuid().nullable(),
});
```

Add, after `export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;`:

```ts
export const MIN_OCCURRENCE_COUNT = 2;
export const MAX_OCCURRENCE_COUNT = 52;
const INVALID_OCCURRENCE_COUNT_MESSAGE = `Кількість повторень має бути від ${MIN_OCCURRENCE_COUNT} до ${MAX_OCCURRENCE_COUNT}`;

export const CreateBookingSeriesSchema = z.object({
  roomId: RoomIdSchema,
  title: z
    .string({ error: BOOKING_REJECTION_MESSAGES.title })
    .trim()
    .min(1, { error: BOOKING_REJECTION_MESSAGES.title })
    .max(100, { error: BOOKING_REJECTION_MESSAGES.title }),
  startsAt: DateTimeSchema,
  endsAt: DateTimeSchema,
  occurrenceCount: z.coerce
    .number({ error: INVALID_OCCURRENCE_COUNT_MESSAGE })
    .int({ error: INVALID_OCCURRENCE_COUNT_MESSAGE })
    .min(MIN_OCCURRENCE_COUNT, { error: INVALID_OCCURRENCE_COUNT_MESSAGE })
    .max(MAX_OCCURRENCE_COUNT, { error: INVALID_OCCURRENCE_COUNT_MESSAGE }),
});

export type CreateBookingSeriesInput = z.infer<typeof CreateBookingSeriesSchema>;
```

`BOOKING_REJECTION_MESSAGES` is already imported at the top of this file (used by `CreateBookingSchema`'s `title` field), so no new import is needed for that. `RoomIdSchema` and `DateTimeSchema` are already defined above in the same file.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/core && npx vitest run src/schemas/booking.test.ts`
Expected: PASS, all tests including the new ones.

- [ ] **Step 5: Export from the package root and run the full core suite**

Edit `packages/core/src/index.ts`, in the `from './schemas/booking'` export block, add `CreateBookingSeriesSchema`, `MIN_OCCURRENCE_COUNT`, `MAX_OCCURRENCE_COUNT`, and `type CreateBookingSeriesInput` to the list.

Run: `cd packages/core && npx vitest run`
Expected: PASS, entire core suite green.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/schemas/booking.ts packages/core/src/schemas/booking.test.ts packages/core/src/index.ts
git commit -m "feat(core): add CreateBookingSeriesSchema and BookingSchema.seriesId"
```

---

### Task 3: Database — `booking_series` table and `bookings.series_id` column

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Create: `apps/api/drizzle/00XX_<generated-name>.sql` (generated, not hand-written)

**Interfaces:**
- Produces: Drizzle table `bookingSeries` (`id`, `userId`, `createdAt`) and `bookings.seriesId` (nullable uuid FK) — consumed by the repository in Task 4.

This task has no test of its own (it's schema + generated SQL); Task 4's repository spec is what exercises it, and Task 7's integration suite is what proves it against real Postgres. Verify by inspection and by re-running the full suite, per the steps below.

- [ ] **Step 1: Add the tables to the Drizzle schema**

Edit `apps/api/src/db/schema.ts`. Insert a new `bookingSeries` table definition after `sessions` and before the `bookings` comment/definition (so it's declared before its first reference, matching the file's existing top-to-bottom reference order):

```ts
// Deliberately thin: the recurrence rule itself is not stored, only a
// grouping handle so "cancel the whole series" can be expressed. Individual
// occurrences are ordinary rows in `bookings`, tagged via `series_id`.
export const bookingSeries = pgTable('booking_series', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Then add a `seriesId` column to the existing `bookings` table definition (inside the same column object, after `canceledAt`):

```ts
    // Soft delete: cancelling frees the room's slot without losing history.
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    // Null for a one-off booking. Set for every occurrence created as part of
    // a weekly series; `on delete set null` so deleting a series row (never
    // done by application code, but kept for schema-level safety) orphans
    // occurrences rather than cascading their deletion.
    seriesId: uuid('series_id').references(() => bookingSeries.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
```

- [ ] **Step 2: Generate the migration**

Run (from repo root): `npm run db:generate`
Expected: a new file appears under `apps/api/drizzle/`, e.g. `0009_<adjective>_<name>.sql`, plus a matching entry in `apps/api/drizzle/meta/`.

- [ ] **Step 3: Verify the generated SQL is exactly the additive change expected**

Read the newly generated `.sql` file. It must contain, in some order, exactly these two statements (drizzle-kit's exact formatting may differ slightly — verify semantics, not byte-for-byte text):

```sql
CREATE TABLE "booking_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "series_id" uuid;
--> statement-breakpoint
ALTER TABLE "booking_series" ADD CONSTRAINT "booking_series_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_series_id_booking_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."booking_series"("id") ON DELETE set null ON UPDATE no action;
```

Confirm it does **not** mention `bookings_no_overlap`, `EXCLUDE`, or `btree_gist` anywhere — this migration must be additive only. If it does, stop and investigate before continuing (it would mean drizzle-kit tried to "fix" the hand-written `0005_bookings_no_overlap.sql` migration, which must never happen).

- [ ] **Step 4: Apply it and confirm the app still boots clean**

```bash
docker compose up --build -d
```

Watch the API container logs for the migration running (`docker compose logs api` if needed) and for `bookings_no_overlap` still being present:

```bash
docker compose exec postgres psql -U booking -d booking -c '\d bookings'
```

Expected: the `series_id` column is listed, `bookings_no_overlap` EXCLUDE constraint is still listed with `USING gist (room_id WITH =, tstzrange(starts_at, ends_at, '[)'::text) WITH &&) WHERE (canceled_at IS NULL)`, and `bookings_series_id_booking_series_id_fk` foreign key is present.

```bash
docker compose exec postgres psql -U booking -d booking -c '\d booking_series'
```

Expected: `id`, `user_id`, `created_at` columns, `booking_series_user_id_users_id_fk` foreign key.

Leave the stack running — Task 4 onward will use it via `npm run test:integration`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat(db): add booking_series table and bookings.series_id column"
```

---

### Task 4: Repository layer — series persistence methods

**Files:**
- Modify: `apps/api/src/bookings/bookings.repository.ts`
- Modify: `apps/api/src/bookings/drizzle-bookings.repository.ts`
- Modify: `apps/api/src/bookings/drizzle-bookings.repository.spec.ts`

**Interfaces:**
- Consumes: `bookingSeries`, `bookings` from `../db/schema` (Task 3); `runQuery` from `../db/driver-errors`.
- Produces (added to `BookingsRepository`, consumed by the service in Task 5):
  - `NewBooking.seriesId?: string`
  - `BookingRow.seriesId: string | null` (now always present on every returned row)
  - `interface BookingOwnershipAndSeries { id: string; userId: string; seriesId: string | null }`
  - `abstract createBookingSeries(userId: string): Promise<{ id: string }>`
  - `abstract deleteBookingSeries(id: string): Promise<void>`
  - `abstract findBookingOwnershipAndSeries(bookingId: string): Promise<BookingOwnershipAndSeries | null>`
  - `abstract cancelBookingSeries(seriesId: string): Promise<void>`

This task deliberately does **not** touch `OwnedBookingRow` or `findBookingById` — those back the existing single-booking `cancel` path (Phase 3) and stay untouched. `findBookingOwnershipAndSeries` is a new, separate lookup used only by series cancellation.

- [ ] **Step 1: Write the failing repository test**

Edit `apps/api/src/bookings/drizzle-bookings.repository.spec.ts`. Update the `insertRejectingWith` helper's `.returning` mock is unaffected — it's testing `createBooking`'s error-translation path, which needs no changes. Add a new `describe` block at the end of the file (before the closing of the file, i.e. after the existing `describe('DrizzleBookingsRepository.createBooking', ...)` block):

```ts
describe('DrizzleBookingsRepository series methods', () => {
  afterEach(() => {
    getConnection.mockReset();
  });

  it('createBookingSeries inserts a row scoped to the given user and returns its id', async () => {
    const returning = jest.fn(() => Promise.resolve([{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }]));
    const values = jest.fn(() => ({ returning }));
    const insert = jest.fn(() => ({ values }));
    getConnection.mockReturnValue({ db: { insert } });

    const result = await new DrizzleBookingsRepository().createBookingSeries('user-id-1');

    expect(result).toEqual({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    expect(values).toHaveBeenCalledWith({ userId: 'user-id-1' });
  });

  it('deleteBookingSeries deletes by id', async () => {
    const where = jest.fn(() => Promise.resolve(undefined));
    const del = jest.fn(() => ({ where }));
    getConnection.mockReturnValue({ db: { delete: del } });

    await new DrizzleBookingsRepository().deleteBookingSeries('series-id-1');

    expect(del).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });

  it('findBookingOwnershipAndSeries returns null when the booking does not exist', async () => {
    const limit = jest.fn(() => Promise.resolve([]));
    const where = jest.fn(() => ({ limit }));
    const from = jest.fn(() => ({ where }));
    const select = jest.fn(() => ({ from }));
    getConnection.mockReturnValue({ db: { select } });

    const result = await new DrizzleBookingsRepository().findBookingOwnershipAndSeries('missing-id');

    expect(result).toBeNull();
  });

  it('findBookingOwnershipAndSeries returns the ownership row when found', async () => {
    const row = { id: 'booking-1', userId: 'user-1', seriesId: 'series-1' };
    const limit = jest.fn(() => Promise.resolve([row]));
    const where = jest.fn(() => ({ limit }));
    const from = jest.fn(() => ({ where }));
    const select = jest.fn(() => ({ from }));
    getConnection.mockReturnValue({ db: { select } });

    const result = await new DrizzleBookingsRepository().findBookingOwnershipAndSeries('booking-1');

    expect(result).toEqual(row);
  });

  it('cancelBookingSeries stamps canceled_at on every live occurrence in the series', async () => {
    const where = jest.fn(() => Promise.resolve(undefined));
    const set = jest.fn(() => ({ where }));
    const update = jest.fn(() => ({ set }));
    getConnection.mockReturnValue({ db: { update } });

    await new DrizzleBookingsRepository().cancelBookingSeries('series-1');

    expect(update).toHaveBeenCalled();
    expect(set).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && npx jest src/bookings/drizzle-bookings.repository.spec.ts`
Expected: FAIL — `createBookingSeries is not a function` (and similarly for the other three new methods), since `DrizzleBookingsRepository` doesn't implement them yet, and `BookingsRepository` doesn't declare them as abstract yet either (a TypeScript compile error if run through `tsc`/`ts-jest`, which is the "fails for the expected reason" here).

- [ ] **Step 3: Write the minimal implementation**

Edit `apps/api/src/bookings/bookings.repository.ts`. Add `seriesId` to `NewBooking` and `BookingRow`:

```ts
export interface BookingRow {
  id: string;
  roomId: number;
  title: string;
  startsAt: Date;
  endsAt: Date;
  userId: string;
  userName: string;
  seriesId: string | null;
}
```

```ts
export interface NewBooking {
  roomId: number;
  userId: string;
  // The creator's own name, known from the session — carried through untouched
  // rather than re-fetched with a join the insert doesn't need.
  userName: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  // Set only when this occurrence belongs to a weekly series (see
  // BookingsService.createSeries). Every existing caller omits it, which
  // inserts NULL — the single-booking create path is unaffected.
  seriesId?: string;
}
```

Add, after the `RoomNotFoundError` class:

```ts
/** Just enough to authorize a series cancel: who owns the booking, and which series (if any) it belongs to. */
export interface BookingOwnershipAndSeries {
  id: string;
  userId: string;
  seriesId: string | null;
}
```

Add four new abstract methods to `BookingsRepository`, after `abstract listMyBookings(...)`:

```ts
  /** Creates the thin grouping row for a new series. The recurrence rule itself is never stored. */
  abstract createBookingSeries(userId: string): Promise<{ id: string }>;
  /** Used only to roll back a series whose every occurrence conflicted — see BookingsService.createSeries. */
  abstract deleteBookingSeries(id: string): Promise<void>;
  abstract findBookingOwnershipAndSeries(bookingId: string): Promise<BookingOwnershipAndSeries | null>;
  /** Soft-cancels every still-live occurrence in the series; idempotent, never touches the booking_series row itself. */
  abstract cancelBookingSeries(seriesId: string): Promise<void>;
```

Edit `apps/api/src/bookings/drizzle-bookings.repository.ts`. Update the import to add `bookingSeries`:

```ts
import { bookings, bookingSeries, rooms, users } from '../db/schema';
```

Update `BOOKING_COLUMNS` to include `seriesId`:

```ts
const BOOKING_COLUMNS = {
  id: bookings.id,
  roomId: bookings.roomId,
  title: bookings.title,
  startsAt: bookings.startsAt,
  endsAt: bookings.endsAt,
  userId: bookings.userId,
  seriesId: bookings.seriesId,
} as const;
```

Update `createBooking`'s insert to pass `seriesId` through:

```ts
          .values({
            roomId: input.roomId,
            userId: input.userId,
            title: input.title,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            seriesId: input.seriesId ?? null,
          })
```

Add the four new methods at the end of the class, after `listMyBookings`:

```ts
  async createBookingSeries(userId: string): Promise<{ id: string }> {
    const [created] = await runQuery('createBookingSeries', () =>
      this.db.insert(bookingSeries).values({ userId }).returning({ id: bookingSeries.id }),
    );
    return created;
  }

  async deleteBookingSeries(id: string): Promise<void> {
    await runQuery('deleteBookingSeries', () => this.db.delete(bookingSeries).where(eq(bookingSeries.id, id)));
  }

  async findBookingOwnershipAndSeries(bookingId: string): Promise<BookingOwnershipAndSeries | null> {
    const [found] = await runQuery('findBookingOwnershipAndSeries', () =>
      this.db
        .select({ id: bookings.id, userId: bookings.userId, seriesId: bookings.seriesId })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1),
    );
    return found ?? null;
  }

  async cancelBookingSeries(seriesId: string): Promise<void> {
    // Same soft-delete stamp as cancelBooking, applied to every still-live
    // occurrence in the series at once. Idempotent: re-running it after
    // every occurrence is already cancelled updates zero rows, not an error.
    await runQuery('cancelBookingSeries', () =>
      this.db
        .update(bookings)
        .set({ canceledAt: sql`now()` })
        .where(and(eq(bookings.seriesId, seriesId), isNull(bookings.canceledAt))),
    );
  }
```

Also update the class's `import type` list to add `BookingOwnershipAndSeries`:

```ts
import {
  BookingsRepository,
  RoomNotFoundError,
  SlotTakenError,
  type BookingOwnershipAndSeries,
  type BookingRow,
  type MyBookingRow,
  type NewBooking,
  type OwnedBookingRow,
  type PaginatedMyBookings,
} from './bookings.repository';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && npx jest src/bookings/drizzle-bookings.repository.spec.ts`
Expected: PASS, all tests including the 5 new ones.

- [ ] **Step 5: Fix the now-broken existing specs (BookingRow gained a required field)**

`BookingRow` now always carries `seriesId`, so every literal in `bookings.service.spec.ts` and `bookings.controller.spec.ts` typed as (or compared against) a `BookingRow` needs the field. This is a mechanical, additive fix — no behavior changes, just `seriesId: null` added to existing fixtures.

Edit `apps/api/src/bookings/bookings.service.spec.ts`. In `VALID_ROW`, add the field:

```ts
const VALID_ROW: BookingRow = {
  id: BOOKING_ID,
  roomId: VALID_INPUT.roomId,
  title: VALID_INPUT.title,
  startsAt: VALID_INPUT.startsAt,
  endsAt: VALID_INPUT.endsAt,
  userId: USER.id,
  userName: USER.name,
  seriesId: null,
};
```

And in the `'returns the created row for a valid, well-formed booking'` test, the `insert` assertion currently does `expect(insert).toEqual({ roomId, userId, userName, title, startsAt, endsAt })` — this stays as-is (it checks what the *service* passed to `createBooking`, and `.create()` never sets `seriesId`, so `insert` still has no `seriesId` key — an `undefined` property is not the same as an absent one for `toEqual`, and the service's `.create()` builds this object with a fixed set of keys, none of which is `seriesId`, so no change needed here).

Edit `apps/api/src/bookings/bookings.controller.spec.ts`. In `RecordingBookingsRepository.createBooking`, the constructed `row` and the destructured `bookingRow` need `seriesId`:

```ts
  async createBooking(input: NewBooking): Promise<BookingRow> {
    if (this.rejectNextCreateWithSlotTaken) {
      throw new SlotTakenError();
    }
    if (this.rejectNextCreateWithRoomNotFound) {
      throw new RoomNotFoundError();
    }
    const row: MyBookingRow & { canceledAt: Date | null; seriesId: string | null } = {
      id: randomUUID(),
      roomId: input.roomId,
      roomName: `Room ${input.roomId}`,
      roomFloor: 1,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      userId: input.userId,
      userName: input.userName,
      canceledAt: null,
      seriesId: input.seriesId ?? null,
    };
    this.byId.set(row.id, row);
    const { roomName, roomFloor, canceledAt, ...bookingRow } = row;
    return bookingRow;
  }
```

Update the class's field type and the two other methods that reference the same map shape (`findBookingById` is unaffected — it returns `OwnedBookingRow`, not `BookingRow`, and that interface is untouched by this plan). Update the field declaration:

```ts
  private readonly byId = new Map<string, MyBookingRow & { canceledAt: Date | null; seriesId: string | null }>();
```

Update `listRoomBookings` (destructures the same shape):

```ts
  async listRoomBookings(): Promise<BookingRow[]> {
    return Array.from(this.byId.values()).map(
      ({ roomName, roomFloor, canceledAt, ...rest }) => rest,
    );
  }
```

This one needs no edit — `rest` already carries `seriesId` through once it's on the stored row shape.

Update `seed()`'s parameter type and default:

```ts
  seed(
    row: Partial<MyBookingRow> & { id: string; userId: string; canceledAt: Date | null; seriesId?: string | null },
  ): void {
    const fullRow: MyBookingRow & { canceledAt: Date | null; seriesId: string | null } = {
      id: row.id,
      roomId: row.roomId ?? 1,
      roomName: row.roomName ?? 'Переговорка 1',
      roomFloor: row.roomFloor ?? 2,
      title: row.title ?? 'Seed',
      startsAt: row.startsAt ?? new Date(),
      endsAt: row.endsAt ?? new Date(),
      userId: row.userId,
      userName: row.userName ?? 'Seed',
      canceledAt: row.canceledAt,
      seriesId: row.seriesId ?? null,
    };
    this.byId.set(row.id, fullRow);
  }
```

Every existing call to `repository.seed({...})` in this file omits `seriesId`, which now defaults to `null` — no other line in the file needs to change.

- [ ] **Step 6: Run the full API unit suite to verify nothing regressed**

Run: `cd apps/api && npm run typecheck && npx jest`
Expected: PASS — `tsc` clean, all existing suites (including `bookings.controller.spec.ts`, `bookings.service.spec.ts`) still green with the mechanical `seriesId` additions.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/bookings/bookings.repository.ts apps/api/src/bookings/drizzle-bookings.repository.ts apps/api/src/bookings/drizzle-bookings.repository.spec.ts apps/api/src/bookings/bookings.service.spec.ts apps/api/src/bookings/bookings.controller.spec.ts
git commit -m "feat(api): add series persistence methods to BookingsRepository"
```

---

### Task 5: Service layer — `createSeries` and `cancelSeries`

**Files:**
- Modify: `apps/api/src/bookings/bookings.errors.ts`
- Modify: `apps/api/src/bookings/bookings.service.ts`
- Modify: `apps/api/src/bookings/bookings.service.spec.ts`

**Interfaces:**
- Consumes: `weeklyOccurrences`, `validateBookingTimes`, `CreateBookingSeriesInput` from `@booking/core` (Tasks 1–2); `createBookingSeries`, `deleteBookingSeries`, `findBookingOwnershipAndSeries`, `cancelBookingSeries` from `BookingsRepository` (Task 4).
- Produces (consumed by the controller in Task 6):
  - `interface CreateSeriesResult { series: { id: string }; created: BookingRow[]; skipped: { startsAt: Date; endsAt: Date }[] }`
  - `BookingsService.createSeries(user: PublicUser, input: CreateBookingSeriesInput): Promise<CreateSeriesResult>`
  - `BookingsService.cancelSeries(user: PublicUser, bookingId: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Edit `apps/api/src/bookings/bookings.errors.ts` — no test file of its own (these are plain functions returning Nest exceptions, exercised via the service/controller specs), so no separate red step here; the assertions in the service spec below cover them.

Edit `apps/api/src/bookings/bookings.service.spec.ts`. Add to the imports:

```ts
import type { CreateBookingInput, CreateBookingSeriesInput, PublicUser } from '@booking/core';
import { weeklyOccurrences } from '@booking/core';
```

(`weeklyOccurrences` is imported here only to compute the expected occurrence dates in assertions — the service itself imports and calls it internally.)

Add near `VALID_INPUT`:

```ts
const VALID_SERIES_INPUT: CreateBookingSeriesInput = {
  roomId: 3,
  title: 'Щотижневий синк',
  startsAt: new Date('2026-01-06T07:00:00Z'), // Tuesday 09:00 Kyiv
  endsAt: new Date('2026-01-06T08:00:00Z'),
  occurrenceCount: 3,
};
```

Add two new `describe` blocks after the existing `describe('cancel', ...)` block:

```ts
  describe('createSeries', () => {
    it('returns 403 for an unverified user, and never creates the series row', async () => {
      useFixedNow();
      const repository = createRepository();

      const error = await createService(repository)
        .createSeries(UNVERIFIED_USER, VALID_SERIES_INPUT)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(repository.createBookingSeries).not.toHaveBeenCalled();
    });

    it('rejects the request with 400 when the first occurrence fails input validation, before any insert', async () => {
      useFixedNow();
      const repository = createRepository();
      // This only proves occurrence 1 is checked before any insert — it does
      // NOT prove a *later* occurrence is checked too. That case is
      // deliberately not tested here: given weeklyOccurrences' Kyiv-wall-clock
      // anchoring (Task 1), a later occurrence cannot fail validation if
      // occurrence 1 passes — wall-clock time (and so alignment/office-hours)
      // is preserved across DST by construction, duration is preserved
      // because Kyiv's DST transitions land at ~03:00, never inside a
      // 09:00–19:00 booking, and `past` only gets easier to satisfy for
      // later occurrences. The per-occurrence loop below is still worth
      // keeping as cheap defense-in-depth — it's what makes this property
      // true rather than merely assumed — but there is no reachable input
      // that exercises its "occurrence 2+ fails" branch, so no test claims
      // to cover one.
      const outOfHoursInput: CreateBookingSeriesInput = {
        ...VALID_SERIES_INPUT,
        startsAt: new Date('2026-01-06T18:00:00Z'), // 20:00 Kyiv
        endsAt: new Date('2026-01-06T19:00:00Z'),
      };

      const error = await createService(repository)
        .createSeries(USER, outOfHoursInput)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(bodyOf(error)).toEqual({ statusCode: 400, errors: { startsAt: ['Поза робочими годинами'] } });
      expect(repository.createBookingSeries).not.toHaveBeenCalled();
      expect(repository.createBooking).not.toHaveBeenCalled();
    });

    it('creates every occurrence, tags each with the new series id, and returns them all in `created`', async () => {
      useFixedNow();
      const repository = createRepository();
      repository.createBookingSeries.mockResolvedValue({ id: 'series-1' });
      const occurrences = weeklyOccurrences(VALID_SERIES_INPUT.startsAt, VALID_SERIES_INPUT.endsAt, VALID_SERIES_INPUT.occurrenceCount);
      let call = 0;
      repository.createBooking.mockImplementation(async (input: NewBooking) => ({
        id: `booking-${call++}`,
        roomId: input.roomId,
        title: input.title,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        userId: input.userId,
        userName: input.userName,
        seriesId: input.seriesId ?? null,
      }));

      const result = await createService(repository).createSeries(USER, VALID_SERIES_INPUT);

      expect(result.series).toEqual({ id: 'series-1' });
      expect(result.created).toHaveLength(3);
      expect(result.skipped).toEqual([]);
      expect(repository.createBooking).toHaveBeenCalledTimes(3);
      for (const [i, occurrence] of occurrences.entries()) {
        const [insert] = repository.createBooking.mock.calls[i] as [NewBooking];
        expect(insert).toMatchObject({ seriesId: 'series-1', startsAt: occurrence.startsAt, endsAt: occurrence.endsAt });
      }
    });

    it('collects a SlotTakenError per conflicting occurrence into `skipped`, and still creates the rest', async () => {
      useFixedNow();
      const repository = createRepository();
      repository.createBookingSeries.mockResolvedValue({ id: 'series-1' });
      let call = 0;
      repository.createBooking.mockImplementation(async (input: NewBooking) => {
        call += 1;
        if (call === 2) throw new SlotTakenError();
        return {
          id: `booking-${call}`,
          roomId: input.roomId,
          title: input.title,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          userId: input.userId,
          userName: input.userName,
          seriesId: input.seriesId ?? null,
        };
      });

      const result = await createService(repository).createSeries(USER, VALID_SERIES_INPUT);

      expect(result.created).toHaveLength(2);
      expect(result.skipped).toHaveLength(1);
      expect(repository.deleteBookingSeries).not.toHaveBeenCalled();
    });

    it('deletes the series row and returns 409 when every occurrence conflicts', async () => {
      useFixedNow();
      const repository = createRepository();
      repository.createBookingSeries.mockResolvedValue({ id: 'series-1' });
      repository.createBooking.mockRejectedValue(new SlotTakenError());

      const error = await createService(repository).createSeries(USER, VALID_SERIES_INPUT).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ConflictException);
      expect(repository.deleteBookingSeries).toHaveBeenCalledWith('series-1');
    });

    it('turns a RoomNotFoundError from the first insert into a 400 field error under roomId', async () => {
      useFixedNow();
      const repository = createRepository();
      repository.createBookingSeries.mockResolvedValue({ id: 'series-1' });
      repository.createBooking.mockRejectedValue(new RoomNotFoundError());

      const error = await createService(repository).createSeries(USER, VALID_SERIES_INPUT).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(bodyOf(error)).toEqual({ statusCode: 400, errors: { roomId: ['Обраної кімнати не існує'] } });
    });
  });

  describe('cancelSeries', () => {
    it('throws 404 when the booking does not exist', async () => {
      const repository = createRepository();
      repository.findBookingOwnershipAndSeries.mockResolvedValue(null);

      const error = await createService(repository).cancelSeries(USER, BOOKING_ID).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundException);
      expect(repository.cancelBookingSeries).not.toHaveBeenCalled();
    });

    it("throws 403 for someone else's booking, before ever checking series membership", async () => {
      const repository = createRepository();
      repository.findBookingOwnershipAndSeries.mockResolvedValue({ id: BOOKING_ID, userId: OTHER_USER_ID, seriesId: null });

      const error = await createService(repository).cancelSeries(USER, BOOKING_ID).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(repository.cancelBookingSeries).not.toHaveBeenCalled();
    });

    it('throws 400 when the booking exists, is owned by the caller, but is not part of any series', async () => {
      const repository = createRepository();
      repository.findBookingOwnershipAndSeries.mockResolvedValue({ id: BOOKING_ID, userId: USER.id, seriesId: null });

      const error = await createService(repository).cancelSeries(USER, BOOKING_ID).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(repository.cancelBookingSeries).not.toHaveBeenCalled();
    });

    it('cancels the whole series for its own booking', async () => {
      const repository = createRepository();
      repository.findBookingOwnershipAndSeries.mockResolvedValue({ id: BOOKING_ID, userId: USER.id, seriesId: 'series-1' });

      await createService(repository).cancelSeries(USER, BOOKING_ID);

      expect(repository.cancelBookingSeries).toHaveBeenCalledWith('series-1');
    });
  });
```

Also update `createRepository()`'s returned mock object to include the four new methods, and `MockedRepository`'s implicit typing already covers them via `{ [K in keyof BookingsRepository]: jest.Mock }` — no change needed there, but `createRepository()`'s object literal must add:

```ts
function createRepository(): MockedRepository {
  return {
    createBooking: jest.fn(async () => VALID_ROW),
    findBookingById: jest.fn(async () => null),
    cancelBooking: jest.fn(async () => undefined),
    listRoomBookings: jest.fn(async () => []),
    listMyBookings: jest.fn(async () => ({ bookings: [], total: 0, page: 1, limit: 10, hasMore: false })),
    createBookingSeries: jest.fn(async () => ({ id: 'series-1' })),
    deleteBookingSeries: jest.fn(async () => undefined),
    findBookingOwnershipAndSeries: jest.fn(async () => null),
    cancelBookingSeries: jest.fn(async () => undefined),
  };
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/api && npx jest src/bookings/bookings.service.spec.ts`
Expected: FAIL — `createSeries is not a function`, `cancelSeries is not a function` (`BookingsService` doesn't implement them yet).

- [ ] **Step 3: Write the minimal implementation**

Edit `apps/api/src/bookings/bookings.errors.ts`. Add two new error builders, after `bookingTimeRejection`:

```ts
const NOT_PART_OF_SERIES_MESSAGE = 'Це бронювання не є частиною серії';
const ALL_OCCURRENCES_TAKEN_MESSAGE = 'Усі повторення серії зайняті';

export function notPartOfSeries(): BadRequestException {
  return new BadRequestException({ statusCode: HttpStatus.BAD_REQUEST, message: NOT_PART_OF_SERIES_MESSAGE });
}

export function allOccurrencesTaken(): ConflictException {
  return new ConflictException({ statusCode: HttpStatus.CONFLICT, message: ALL_OCCURRENCES_TAKEN_MESSAGE });
}
```

Edit `apps/api/src/bookings/bookings.service.ts`. Update imports:

```ts
import type { CreateBookingInput, CreateBookingSeriesInput, MyBookingsQuery, PublicUser } from '@booking/core';
import { validateBookingTimes, weeklyOccurrences } from '@booking/core';
import { Injectable } from '@nestjs/common';
import {
  allOccurrencesTaken,
  bookingAlreadyCanceled,
  bookingNotFound,
  bookingTimeRejection,
  cannotCancelOthersBooking,
  emailVerificationRequired,
  notPartOfSeries,
  roomNotFound,
  slotTaken,
} from './bookings.errors';
import {
  BookingsRepository,
  RoomNotFoundError,
  SlotTakenError,
  type BookingRow,
  type PaginatedMyBookings,
} from './bookings.repository';
```

Add a result type and the two methods, after `cancel`:

```ts
export interface CreateSeriesResult {
  series: { id: string };
  created: BookingRow[];
  skipped: { startsAt: Date; endsAt: Date }[];
}
```

(Place this interface above the `BookingsService` class, alongside the class's other type usage.)

```ts
  async createSeries(user: PublicUser, input: CreateBookingSeriesInput): Promise<CreateSeriesResult> {
    if (!user.emailVerifiedAt) {
      throw emailVerificationRequired();
    }

    const now = new Date();
    const occurrences = weeklyOccurrences(input.startsAt, input.endsAt, input.occurrenceCount);

    // Every occurrence's alignment/duration/office-hours must be valid
    // before any insert happens — a later occurrence can fail purely
    // because a DST transition shifted its Kyiv wall-clock time, and that
    // is an input problem with the whole request, not a per-occurrence
    // conflict like slotTaken.
    for (const occurrence of occurrences) {
      const rejection = validateBookingTimes(occurrence, now);
      if (rejection) {
        throw bookingTimeRejection(rejection);
      }
    }

    const series = await this.bookingsRepo.createBookingSeries(user.id);
    const created: BookingRow[] = [];
    const skipped: { startsAt: Date; endsAt: Date }[] = [];

    for (const occurrence of occurrences) {
      try {
        const row = await this.bookingsRepo.createBooking({
          roomId: input.roomId,
          userId: user.id,
          userName: user.name,
          title: input.title,
          startsAt: occurrence.startsAt,
          endsAt: occurrence.endsAt,
          seriesId: series.id,
        });
        created.push(row);
      } catch (error) {
        if (error instanceof SlotTakenError) {
          skipped.push(occurrence);
          continue;
        }
        if (error instanceof RoomNotFoundError) {
          throw roomNotFound();
        }
        throw error;
      }
    }

    if (created.length === 0) {
      // No occurrence made it in — leave no orphan booking_series row
      // behind for a psql inspection to find.
      await this.bookingsRepo.deleteBookingSeries(series.id);
      throw allOccurrencesTaken();
    }

    return { series: { id: series.id }, created, skipped };
  }

  async cancelSeries(user: PublicUser, bookingId: string): Promise<void> {
    const info = await this.bookingsRepo.findBookingOwnershipAndSeries(bookingId);
    if (!info) {
      throw bookingNotFound();
    }
    // Ownership checked before series membership, mirroring `cancel()`'s
    // ownership-before-state ordering: a stranger probing someone else's
    // booking id always gets the same 403, never a 400 that would leak
    // whether the booking is part of a series.
    if (info.userId !== user.id) {
      throw cannotCancelOthersBooking();
    }
    if (!info.seriesId) {
      throw notPartOfSeries();
    }
    await this.bookingsRepo.cancelBookingSeries(info.seriesId);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/api && npx jest src/bookings/bookings.service.spec.ts`
Expected: PASS, all tests including the new `createSeries` and `cancelSeries` blocks.

- [ ] **Step 5: Run the full API unit suite**

Run: `cd apps/api && npm run typecheck && npx jest`
Expected: PASS, everything green, including the untouched `create`/`cancel` describe blocks (proof this task didn't disturb them).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/bookings/bookings.errors.ts apps/api/src/bookings/bookings.service.ts apps/api/src/bookings/bookings.service.spec.ts
git commit -m "feat(api): add BookingsService.createSeries and cancelSeries"
```

---

### Task 6: Controller — `POST /api/bookings/series` and `?scope=series`

**Files:**
- Modify: `apps/api/src/bookings/bookings.controller.ts`
- Modify: `apps/api/src/bookings/bookings.controller.spec.ts`

**Interfaces:**
- Consumes: `CreateBookingSeriesSchema` from `@booking/core` (Task 2); `BookingsService.createSeries`/`.cancelSeries` (Task 5).
- Produces: `POST /api/bookings/series` → 201 `{ series, created, skipped }` | 400 | 409; `DELETE /api/bookings/:id?scope=series` → 204 | 400 | 403 | 404.

- [ ] **Step 1: Write the failing tests**

Edit `apps/api/src/bookings/bookings.controller.spec.ts`. Add near `VALID_BODY`:

```ts
const VALID_SERIES_BODY = {
  roomId: 3,
  title: 'Щотижневий синк',
  startsAt: '2027-01-05T07:00:00.000Z', // Tuesday 09:00 Kyiv, safely in the future relative to NOW
  endsAt: '2027-01-05T08:00:00.000Z',
  occurrenceCount: 3,
};
```

Add request helpers alongside the existing `postBooking`/`deleteBooking`:

```ts
  const postSeries = (body: object) => request(app.getHttpServer()).post('/api/bookings/series').set('Cookie', cookie).send(body);
  const deleteBookingScoped = (id: string, scope: string) =>
    request(app.getHttpServer()).delete(`/api/bookings/${id}?scope=${scope}`).set('Cookie', cookie);
```

Add two new `describe` blocks, after `describe('DELETE /api/bookings/:id', ...)`:

```ts
  describe('POST /api/bookings/series', () => {
    it('creates every occurrence and returns 201 with { series, created, skipped }', async () => {
      const response = await postSeries(VALID_SERIES_BODY).expect(201);

      expect(response.body.series.id).toEqual(expect.any(String));
      expect(response.body.created).toHaveLength(3);
      expect(response.body.skipped).toEqual([]);
      for (const created of response.body.created) {
        expect(created.roomId).toBe(VALID_SERIES_BODY.roomId);
      }
    });

    it('rejects an occurrence count below the minimum with a 400', async () => {
      const response = await postSeries({ ...VALID_SERIES_BODY, occurrenceCount: 1 }).expect(400);

      expect(response.body.errors.occurrenceCount).toBeDefined();
    });

    it('turns an all-occurrences-conflict into 409', async () => {
      repository.rejectNextCreateWithSlotTaken = true;

      await postSeries(VALID_SERIES_BODY).expect(409);
    });

    it('requires a session', async () => {
      await request(app.getHttpServer()).post('/api/bookings/series').send(VALID_SERIES_BODY).expect(401);
    });
  });

  describe('DELETE /api/bookings/:id?scope=series', () => {
    it('cancels every occurrence sharing the series and returns 204', async () => {
      const created = await postSeries(VALID_SERIES_BODY).expect(201);
      const firstOccurrenceId = created.body.created[0].id;

      await deleteBookingScoped(firstOccurrenceId, 'series').expect(204);

      for (const occurrence of created.body.created) {
        await expect(repository.findBookingById(occurrence.id)).resolves.toMatchObject({ canceledAt: expect.any(Date) });
      }
    });

    it('returns 400 when the target booking is not part of any series', async () => {
      const created = await postBooking(VALID_BODY).expect(201);
      const { id } = (created.body as { booking: BookingRow }).booking;

      await deleteBookingScoped(id, 'series').expect(400);
    });

    it("returns 403 for someone else's series booking, without cancelling it", async () => {
      const othersId = randomUUID();
      repository.seed({ id: othersId, userId: OTHER_USER_ID, canceledAt: null, seriesId: 'series-x' });

      await deleteBookingScoped(othersId, 'series').expect(403);

      await expect(repository.findBookingById(othersId)).resolves.toMatchObject({ canceledAt: null });
    });

    it('returns 404 for an unknown id with scope=series', async () => {
      await deleteBookingScoped(randomUUID(), 'series').expect(404);
    });
  });
```

`RecordingBookingsRepository` (from Task 4's Step 5 edits) already implements `createBookingSeries`, `deleteBookingSeries`, `findBookingOwnershipAndSeries`, and `cancelBookingSeries`? **No** — Task 4 only added those to the *Drizzle* implementation and the *service* mock; the controller spec's hand-written `RecordingBookingsRepository` double still needs them, since it `extends BookingsRepository` and must implement every abstract method to compile. Add these to the class, after `listRoomBookings`:

```ts
  async createBookingSeries(userId: string): Promise<{ id: string }> {
    const id = randomUUID();
    this.seriesOwners.set(id, userId);
    return { id };
  }

  async deleteBookingSeries(id: string): Promise<void> {
    this.seriesOwners.delete(id);
  }

  async findBookingOwnershipAndSeries(bookingId: string): Promise<BookingOwnershipAndSeries | null> {
    const found = this.byId.get(bookingId);
    return found ? { id: found.id, userId: found.userId, seriesId: found.seriesId } : null;
  }

  async cancelBookingSeries(seriesId: string): Promise<void> {
    for (const row of this.byId.values()) {
      if (row.seriesId === seriesId && row.canceledAt === null) {
        row.canceledAt = new Date();
      }
    }
  }
```

Add the backing field near `byId`:

```ts
  private readonly seriesOwners = new Map<string, string>();
```

Add `BookingOwnershipAndSeries` to the existing type-only import block at the top of the file:

```ts
import {
  BookingsRepository,
  RoomNotFoundError,
  SlotTakenError,
  type BookingOwnershipAndSeries,
  type BookingRow,
  type MyBookingRow,
  type NewBooking,
  type OwnedBookingRow,
  type PaginatedMyBookings,
} from './bookings.repository';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/api && npx jest src/bookings/bookings.controller.spec.ts`
Expected: FAIL — `404 Not Found` / `Cannot POST /api/bookings/series` for the new endpoint, and `?scope=series` is silently ignored by the existing `DELETE :id` handler (it calls the single-cancel path regardless), so the series-cancel tests fail on wrong status codes.

- [ ] **Step 3: Write the minimal implementation**

Edit `apps/api/src/bookings/bookings.controller.ts`:

```ts
import { CreateBookingSchema, CreateBookingSeriesSchema, MyBookingsQuerySchema, type PublicUser } from '@booking/core';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { parseOrThrow } from '../common/parse-or-throw';
import { BookingsService, type CreateSeriesResult } from './bookings.service';
import type { BookingRow, PaginatedMyBookings } from './bookings.repository';

// A non-uuid `:id` must be a clean 400, not a 500 from Postgres choking on the
// cast, so it's validated the same way as any request body.
const BookingIdParamSchema = z.object({ id: z.uuid() });
const CancelBookingQuerySchema = z.object({ scope: z.enum(['series']).optional() });

@Controller('api/bookings')
@UseGuards(AuthGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('mine')
  async listMine(@Query() queryParams: unknown, @CurrentUser() user: PublicUser): Promise<PaginatedMyBookings> {
    const query = parseOrThrow(MyBookingsQuerySchema, queryParams);
    return this.bookings.listMine(user, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown, @CurrentUser() user: PublicUser): Promise<{ booking: BookingRow }> {
    const input = parseOrThrow(CreateBookingSchema, body);
    return { booking: await this.bookings.create(user, input) };
  }

  @Post('series')
  @HttpCode(HttpStatus.CREATED)
  async createSeries(@Body() body: unknown, @CurrentUser() user: PublicUser): Promise<CreateSeriesResult> {
    const input = parseOrThrow(CreateBookingSeriesSchema, body);
    return this.bookings.createSeries(user, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@Param() params: unknown, @Query() query: unknown, @CurrentUser() user: PublicUser): Promise<void> {
    const { id } = parseOrThrow(BookingIdParamSchema, params);
    const { scope } = parseOrThrow(CancelBookingQuerySchema, query);
    if (scope === 'series') {
      await this.bookings.cancelSeries(user, id);
      return;
    }
    await this.bookings.cancel(user, id);
  }
}
```

(`BookingsService` needs to export the `CreateSeriesResult` type for this import — it already does, as an exported interface from Task 5.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/api && npx jest src/bookings/bookings.controller.spec.ts`
Expected: PASS, all tests including the new series create/cancel blocks, and every pre-existing test in this file (proof `?scope=series` being absent still routes to the untouched single-cancel path).

- [ ] **Step 5: Run the full API unit suite**

Run: `cd apps/api && npm run typecheck && npx jest`
Expected: PASS, entire `apps/api` suite green.

- [ ] **Step 6: Run the full root unit suite with Docker stopped**

Run (from repo root, with `docker compose down` first if the stack from Task 3 is still up): `npm test`
Expected: PASS — this is the standing rule check: the whole monorepo's unit tests are green with no database running.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/bookings/bookings.controller.ts apps/api/src/bookings/bookings.controller.spec.ts
git commit -m "feat(api): add POST /api/bookings/series and ?scope=series cancel"
```

---

### Task 7: API integration tests — series create/cancel against real Postgres

**Files:**
- Modify: `apps/api/test/bookings.int-spec.ts`

**Interfaces:**
- Consumes: the live HTTP surface from Task 6, against a real Postgres (proves the EXCLUDE constraint and the FK from `bookings.series_id` to `booking_series.id` both actually work, which no unit test with a mocked `db` can prove).

- [ ] **Step 1: Write the integration tests**

Edit `apps/api/test/bookings.int-spec.ts`. Add a new `describe` block at the end of the file, before the final closing `});`:

```ts
  describe('Weekly recurring bookings (Phase 8.4)', () => {
    it('19. Creating a series with no conflicts inserts one row per occurrence, all sharing one series_id', async () => {
      const { cookie } = await createUser('Series Clean', 'series-clean@example.com');

      const res = await request(app.getHttpServer())
        .post('/api/bookings/series')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: 'Weekly Sync',
          startsAt: '2028-06-16T07:00:00.000Z', // Tuesday 10:00 Kyiv (EEST)
          endsAt: '2028-06-16T08:00:00.000Z',
          occurrenceCount: 3,
        });

      expect(res.status).toBe(201);
      expect(res.body.created).toHaveLength(3);
      expect(res.body.skipped).toEqual([]);

      const { db } = getConnection();
      const rows = await db.select().from(bookings).where(eq(bookings.seriesId, res.body.series.id));
      expect(rows.length).toBe(3);
      expect(rows.every((r) => r.seriesId === res.body.series.id)).toBe(true);

      const [seriesRow] = await db.select().from(bookingSeries).where(eq(bookingSeries.id, res.body.series.id));
      expect(seriesRow).toBeDefined();
    });

    it('20. Creating a series that partially conflicts creates only the non-conflicting occurrences and reports the rest as skipped', async () => {
      const { cookie: existingCookie } = await createUser('Series Blocker', 'series-blocker@example.com');
      const { cookie: seriesCookie } = await createUser('Series Partial', 'series-partial@example.com');

      // Occupies what would otherwise be occurrence 2 of the series below
      // (Tuesday 2028-06-23, 10:00-11:00 Kyiv).
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', existingCookie)
        .send({
          roomId: 1,
          title: 'Pre-existing block',
          startsAt: '2028-06-23T07:00:00.000Z',
          endsAt: '2028-06-23T08:00:00.000Z',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/bookings/series')
        .set('Cookie', seriesCookie)
        .send({
          roomId: 1,
          title: 'Weekly Sync Partial',
          startsAt: '2028-06-16T07:00:00.000Z',
          endsAt: '2028-06-16T08:00:00.000Z',
          occurrenceCount: 3,
        });

      expect(res.status).toBe(201);
      expect(res.body.created).toHaveLength(2);
      expect(res.body.skipped).toHaveLength(1);

      const { db } = getConnection();
      const rows = await db.select().from(bookings).where(eq(bookings.seriesId, res.body.series.id));
      expect(rows.length).toBe(2);
    });

    it('21. Creating a series where every occurrence conflicts returns 409 and leaves no booking_series row behind', async () => {
      const { cookie: existingCookie } = await createUser('Series AllBlock Owner', 'series-allblock-owner@example.com');
      const { cookie: seriesCookie } = await createUser('Series AllBlock', 'series-allblock@example.com');

      for (const [start, end] of [
        ['2028-06-16T07:00:00.000Z', '2028-06-16T08:00:00.000Z'],
        ['2028-06-23T07:00:00.000Z', '2028-06-23T08:00:00.000Z'],
      ]) {
        await request(app.getHttpServer())
          .post('/api/bookings')
          .set('Cookie', existingCookie)
          .send({ roomId: 1, title: 'Blocker', startsAt: start, endsAt: end })
          .expect(201);
      }

      const beforeCount = (await getConnection().db.select().from(bookingSeries)).length;

      const res = await request(app.getHttpServer())
        .post('/api/bookings/series')
        .set('Cookie', seriesCookie)
        .send({
          roomId: 1,
          title: 'Weekly Sync Blocked',
          startsAt: '2028-06-16T07:00:00.000Z',
          endsAt: '2028-06-16T08:00:00.000Z',
          occurrenceCount: 2,
        });

      expect(res.status).toBe(409);

      const afterCount = (await getConnection().db.select().from(bookingSeries)).length;
      expect(afterCount).toBe(beforeCount);
    });

    it('22. Cancelling one occurrence of a series leaves the rest of the series live', async () => {
      const { cookie } = await createUser('Series CancelOne', 'series-cancelone@example.com');

      const created = await request(app.getHttpServer())
        .post('/api/bookings/series')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: 'Weekly Sync CancelOne',
          startsAt: '2028-06-16T07:00:00.000Z',
          endsAt: '2028-06-16T08:00:00.000Z',
          occurrenceCount: 3,
        })
        .expect(201);

      const firstId = created.body.created[0].id;
      const secondId = created.body.created[1].id;

      await request(app.getHttpServer()).delete(`/api/bookings/${firstId}`).set('Cookie', cookie).expect(204);

      const { db } = getConnection();
      const [firstRow] = await db.select().from(bookings).where(eq(bookings.id, firstId));
      const [secondRow] = await db.select().from(bookings).where(eq(bookings.id, secondId));
      expect(firstRow.canceledAt).not.toBeNull();
      expect(secondRow.canceledAt).toBeNull();
    });

    it('23. Cancelling scope=series cancels every remaining occurrence and leaves the booking_series row in place', async () => {
      const { cookie } = await createUser('Series CancelAll', 'series-cancelall@example.com');

      const created = await request(app.getHttpServer())
        .post('/api/bookings/series')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: 'Weekly Sync CancelAll',
          startsAt: '2028-06-16T07:00:00.000Z',
          endsAt: '2028-06-16T08:00:00.000Z',
          occurrenceCount: 3,
        })
        .expect(201);

      const seriesId = created.body.series.id;
      const anyOccurrenceId = created.body.created[0].id;

      await request(app.getHttpServer())
        .delete(`/api/bookings/${anyOccurrenceId}?scope=series`)
        .set('Cookie', cookie)
        .expect(204);

      const { db } = getConnection();
      const rows = await db.select().from(bookings).where(eq(bookings.seriesId, seriesId));
      expect(rows.every((r) => r.canceledAt !== null)).toBe(true);

      const [seriesRow] = await db.select().from(bookingSeries).where(eq(bookingSeries.id, seriesId));
      expect(seriesRow).toBeDefined();
    });

    it("24. Cancelling scope=series on another user's booking returns 403 and cancels nothing", async () => {
      const { cookie: ownerCookie } = await createUser('Series Owner', 'series-owner-403@example.com');
      const { cookie: strangerCookie } = await createUser('Series Stranger', 'series-stranger-403@example.com');

      const created = await request(app.getHttpServer())
        .post('/api/bookings/series')
        .set('Cookie', ownerCookie)
        .send({
          roomId: 1,
          title: 'Weekly Sync Protected',
          startsAt: '2028-06-16T07:00:00.000Z',
          endsAt: '2028-06-16T08:00:00.000Z',
          occurrenceCount: 2,
        })
        .expect(201);

      const seriesId = created.body.series.id;
      const anyOccurrenceId = created.body.created[0].id;

      await request(app.getHttpServer())
        .delete(`/api/bookings/${anyOccurrenceId}?scope=series`)
        .set('Cookie', strangerCookie)
        .expect(403);

      const { db } = getConnection();
      const rows = await db.select().from(bookings).where(eq(bookings.seriesId, seriesId));
      expect(rows.every((r) => r.canceledAt === null)).toBe(true);
    });
  });
```

Update the file's imports at the top to add `bookingSeries`:

```ts
import { bookings, bookingSeries, users } from '../src/db/schema';
```

- [ ] **Step 2: Run the tests — this is a verification step, not a red/green cycle**

By this point in the plan Tasks 1–6 are already committed, so the API surface these tests exercise already exists — the unit tests in Tasks 4–6 already carried this feature's TDD cycle. What this step actually proves is different: it's the only place in the plan that runs the new code against a *real* Postgres, exercising the real `bookings_no_overlap` EXCLUDE constraint and the real `bookings_series_id_booking_series_id_fk` foreign key together — neither of which any mocked-`db` unit test can prove.

Run (Docker running, from Task 3): `npm run test:integration`
Expected: PASS, all 6 new tests (19–24). If any of them fails, that is a real finding — either this task's test code has a mistake, or (more seriously) the Drizzle schema/migration from Task 3 doesn't match what the service layer assumes. Do not proceed to Step 3 until this is green.

- [ ] **Step 3: Run the full integration suite and confirm the count only grew**

Run: `npm run test:integration`
Expected: PASS. Total test count is Task 0's baseline count + 6 (tests 19–24). None of tests 1–18 changed behavior.

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/bookings.int-spec.ts
git commit -m "test(api): add integration coverage for weekly recurring bookings"
```

---

### Task 8: Frontend API client — series create + scoped cancel

**Files:**
- Modify: `apps/web/src/features/bookings/useBookingMutations.ts`
- Modify: `apps/web/src/features/rooms/RoomSchedulePage.tsx` (only its `handleCancelConfirm` call site — folded in here rather than left for Task 11, so this commit never leaves the web workspace in a non-compiling state; see the note at the end of this task)

**Interfaces:**
- Consumes: `postJson`, `apiRequest` from `../../lib/api` (unchanged); `CreateSeriesResult`-shaped response (structurally, not imported — the web app has no dependency on `apps/api`, so this is inferred from the JSON shape, matching how `useCreateBooking` already treats `Booking` as the response type without importing API-side types).
- Produces: `useCreateBookingSeries(roomId, weekStartISO)`, and `useCancelBooking(roomId, weekStartISO)` gains an optional `scope` argument on its `mutate`/`mutateAsync` call.

**A cache-scoping note before writing this:** a series spans 2–52 *future* weeks, each cached under its own `['room', roomId, 'bookings', <thatWeek'sStartISO>]` key. `useCreateBooking` (single-booking) correctly invalidates only the current week's exact key. `useCreateBookingSeries` and the `scope === 'series'` branch of `useCancelBooking` must instead invalidate the **prefix** `['room', roomId, 'bookings']` — TanStack Query matches query keys by prefix, so this refetches every cached week at once. Getting this wrong means: create an 8-week series, page to "next week," see a stale grid; cancel the whole series, other weeks keep showing the cancelled occurrences as live until something else happens to refetch them.

- [ ] **Step 1: Write the failing test**

There is no existing test file for `useBookingMutations.ts` (verify: `find apps/web/src/features/bookings -name 'useBookingMutations*'`). Rather than introduce a new React Query test harness for this one hook file, this task is covered end-to-end by Task 9/10/11's component tests, which exercise these hooks through `renderHook`-free component interaction (matching how `CreateBookingModal.test.tsx` already covers `onSubmit` without testing `useCreateBooking` in isolation). Skip a dedicated red/green cycle for this file; its correctness is proven by the component tests in Tasks 9–11 and by the manual proof in Task 12. This is a deliberate, narrow exception to the task's TDD requirement — flag it in the commit message.

- [ ] **Step 2: Implement**

Edit `apps/web/src/features/bookings/useBookingMutations.ts`. Add near the top, after the imports:

```ts
export interface BookingSeriesResult {
  series: { id: string };
  created: Booking[];
  skipped: { startsAt: string; endsAt: string }[];
}
```

Add a new hook, after `useCreateBooking`:

```ts
// `_weekStartISO` is unused: unlike the other two hooks, this one invalidates
// every cached week (a series spans many), not just the current one. Kept as
// a parameter anyway so the call site reads the same as its two siblings.
export function useCreateBookingSeries(roomId: string, _weekStartISO: string) {
  const queryClient = useQueryClient();
  // Prefix key, not the current week's exact key — a series can create
  // occurrences across many future weeks, each cached separately.
  const roomBookingsPrefix = ['room', roomId, 'bookings'];

  return useMutation({
    mutationFn: (data: unknown) => postJson<BookingSeriesResult>('/bookings/series', data),
    onSuccess: () => {
      // No optimistic update here — a series can partially conflict, so the
      // only correct post-state is whatever the server actually persisted.
      void queryClient.invalidateQueries({ queryKey: roomBookingsPrefix });
    },
  });
}
```

Update `useCancelBooking` to accept an optional scope, changing its `mutationFn` input shape from a bare `bookingId: string` to an object (the call site is fixed in the same commit — see Step 2's continuation below):

```ts
export function useCancelBooking(roomId: string, weekStartISO: string) {
  const queryClient = useQueryClient();
  const queryKey = ['room', roomId, 'bookings', weekStartISO];
  const roomBookingsPrefix = ['room', roomId, 'bookings'];

  return useMutation({
    mutationFn: ({ bookingId, scope }: { bookingId: string; scope?: 'series' }) =>
      apiRequest<void>(`/bookings/${bookingId}${scope ? `?scope=${scope}` : ''}`, { method: 'DELETE' }),
    onMutate: async ({ bookingId, scope }: { bookingId: string; scope?: 'series' }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<{ bookings: Booking[] }>(queryKey);

      if (previousData) {
        // Look up the target's seriesId once, outside the filter callback —
        // filtering is O(n), and re-running `.find` per item made this O(n^2)
        // for no reason. If the target isn't in this week's cache at all
        // (e.g. cancelling an occurrence from a week the grid hasn't loaded
        // yet), this optimistic step is a no-op and `onSettled` below still
        // invalidates for correctness.
        const target = previousData.bookings.find((b) => b.id === bookingId);
        queryClient.setQueryData<{ bookings: Booking[] }>(queryKey, {
          ...previousData,
          bookings:
            scope === 'series' && target?.seriesId
              ? previousData.bookings.filter((booking) => booking.seriesId !== target.seriesId)
              : previousData.bookings.filter((booking) => booking.id !== bookingId),
        });
      }

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: (_data, _error, { scope }) => {
      // scope=series can touch occurrences in other cached weeks besides
      // this one — invalidate the whole room's prefix in that case, not
      // just the exact key this mutation happened to be constructed with.
      void queryClient.invalidateQueries({ queryKey: scope === 'series' ? roomBookingsPrefix : queryKey });
    },
  });
}
```

- [ ] **Step 3: Fix the `RoomSchedulePage.tsx` call site in the same commit**

`useCancelBooking`'s `mutateAsync` now expects `{ bookingId, scope? }` instead of a bare string. Edit `apps/web/src/features/rooms/RoomSchedulePage.tsx`'s existing `handleCancelConfirm`, replacing:

```ts
  const handleCancelConfirm = async () => {
    if (!bookingToCancel) return;
    setCancelError(null);
    try {
      await cancelMutation.mutateAsync(bookingToCancel.id);
      setIsCancelOpen(false);
      setBookingToCancel(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Ви не можете скасувати це бронювання';
      setCancelError(msg);
    }
  };
```

with:

```ts
  const handleCancelConfirm = async (scope?: 'series') => {
    if (!bookingToCancel) return;
    setCancelError(null);
    try {
      await cancelMutation.mutateAsync({ bookingId: bookingToCancel.id, scope });
      setIsCancelOpen(false);
      setBookingToCancel(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Ви не можете скасувати це бронювання';
      setCancelError(msg);
    }
  };
```

This signature, `(scope?: 'series') => Promise<void>`, is also exactly what `CancelBookingDialog`'s `onConfirm` prop will require once Task 10 changes it — so this fix does not need to be revisited there. It's a no-op for `CancelBookingDialog`'s current (pre-Task-10) prop type, since a function typed to accept an optional parameter is assignable wherever a zero-argument callback is expected.

- [ ] **Step 4: Run the web unit suite**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: PASS — no broken intermediate state. Every existing test (including `Phase5.test.tsx`, which exercises the cancel flow) stays green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/bookings/useBookingMutations.ts apps/web/src/features/rooms/RoomSchedulePage.tsx
git commit -m "feat(web): add useCreateBookingSeries and scope param on useCancelBooking"
```

---

### Task 9: `CreateBookingModal` — weekly repeat toggle

**Files:**
- Modify: `apps/web/src/features/bookings/CreateBookingModal.tsx`
- Modify: `apps/web/src/features/bookings/CreateBookingModal.test.tsx`

**Interfaces:**
- Produces: `CreateBookingModalProps` gains `onSubmitSeries?: (values: { title: string; startsAt: string; endsAt: string; occurrenceCount: number }) => Promise<void>` and `isSubmittingSeries?: boolean` — consumed by `RoomSchedulePage.tsx` in Task 11.

- [ ] **Step 1: Write the failing test**

Edit `apps/web/src/features/bookings/CreateBookingModal.test.tsx`. Add a new test after the existing `'submits form values when title is provided'` test (read the existing test's setup pattern first — it renders with a default `onSubmit` prop and fills the title field; mirror that exact render/props pattern for consistency, adding the two new props):

```tsx
  it('shows a weekly-repeat toggle and occurrence count, and calls onSubmitSeries with the count when checked', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onSubmitSeries = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <CreateBookingModal
        {...defaultProps}
        onSubmit={onSubmit}
        onSubmitSeries={onSubmitSeries}
      />,
    );

    await user.type(screen.getByLabelText('Назва події'), 'Щотижневий синк');
    await user.click(screen.getByLabelText('Повторювати щотижня'));

    const countInput = screen.getByLabelText('Кількість повторень');
    await user.clear(countInput);
    await user.type(countInput, '8');

    await user.click(screen.getByRole('button', { name: /Забронювати/ }));

    expect(onSubmitSeries).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Щотижневий синк', occurrenceCount: 8 }),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('defaults to the single-booking submit path when the repeat toggle is off', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onSubmitSeries = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <CreateBookingModal
        {...defaultProps}
        onSubmit={onSubmit}
        onSubmitSeries={onSubmitSeries}
      />,
    );

    await user.type(screen.getByLabelText('Назва події'), 'Одноразова подія');
    await user.click(screen.getByRole('button', { name: /Забронювати/ }));

    expect(onSubmit).toHaveBeenCalled();
    expect(onSubmitSeries).not.toHaveBeenCalled();
  });
```

This references a `defaultProps` object and `userEvent`/`screen`/`render` imports — open the existing test file's top and confirm what's already imported and how the existing tests construct props (they likely inline props per test rather than share a `defaultProps` object). Match the file's actual existing pattern exactly rather than introducing a new one; if the file has no shared `defaultProps`, spread the same literal props object the neighboring tests use instead of `{...defaultProps}`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx vitest run src/features/bookings/CreateBookingModal.test.tsx`
Expected: FAIL — `Unable to find a label with the text of: Повторювати щотижня` (the toggle doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation**

Edit `apps/web/src/features/bookings/CreateBookingModal.tsx`. Add to `CreateBookingModalProps`:

```ts
  onSubmitSeries?: (values: { title: string; startsAt: string; endsAt: string; occurrenceCount: number }) => Promise<void>;
  isSubmittingSeries?: boolean;
```

Add local state for the toggle and count, near the top of the component body (after the `useForm` destructure):

```ts
  const [isRepeating, setIsRepeating] = useState(false);
  const [occurrenceCount, setOccurrenceCount] = useState(8);
```

Add `useState` to the React import at the top of the file:

```ts
import React, { useEffect, useMemo, useState } from 'react';
```

Update `handleFormSubmit` to branch on `isRepeating`:

```ts
  const handleFormSubmit = handleSubmit(async (data) => {
    if (isOverlapping) return;
    const startsAtStr =
      typeof data.startsAt === 'string'
        ? data.startsAt
        : (data.startsAt as Date).toISOString();
    const endsAtStr =
      typeof data.endsAt === 'string'
        ? data.endsAt
        : (data.endsAt as Date).toISOString();

    if (isRepeating && onSubmitSeries) {
      await onSubmitSeries({ title: data.title, startsAt: startsAtStr, endsAt: endsAtStr, occurrenceCount });
      return;
    }

    await onSubmit({
      title: data.title,
      startsAt: startsAtStr,
      endsAt: endsAtStr,
    });
  });
```

Add the toggle and count input to the JSX, after the start/end time `grid grid-cols-2` block and before the `{timeError && (...)}` block:

```tsx
          <div className="flex items-center gap-s3">
            <input
              id="repeat-weekly-toggle"
              type="checkbox"
              checked={isRepeating}
              onChange={(e) => setIsRepeating(e.target.checked)}
              disabled={isSubmitting}
              className="size-[18px] rounded-[4px] border border-outline-variant accent-primary cursor-pointer"
            />
            <label htmlFor="repeat-weekly-toggle" className="text-label-medium text-on-surface-variant font-bold cursor-pointer">
              Повторювати щотижня
            </label>
            {isRepeating && (
              <div className="flex items-center gap-s2 ml-auto">
                <label htmlFor="occurrence-count-input" className="text-label-medium text-on-surface-variant font-bold">
                  Кількість повторень
                </label>
                <input
                  id="occurrence-count-input"
                  type="number"
                  min={2}
                  max={52}
                  value={occurrenceCount}
                  onChange={(e) => setOccurrenceCount(Number(e.target.value))}
                  disabled={isSubmitting}
                  className="w-[64px] px-2 py-1 rounded-[var(--radius-sm)] border border-outline-variant text-center"
                />
              </div>
            )}
          </div>
```

Update the submit button's `disabled` to also respect `isSubmittingSeries`, and the loading text — find the existing `isSubmitting` prop and add `isSubmittingSeries` alongside it in the same conditionals (`disabled={isSubmitting}` on the submit button becomes `disabled={isSubmitting || isSubmittingSeries}`, and `submitButtonText`'s `isSubmitting ?` check becomes `(isSubmitting || isSubmittingSeries) ?`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && npx vitest run src/features/bookings/CreateBookingModal.test.tsx`
Expected: PASS, all tests including the 2 new ones and every pre-existing test in the file (the toggle defaults to unchecked, so the existing single-booking tests are unaffected).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/bookings/CreateBookingModal.tsx apps/web/src/features/bookings/CreateBookingModal.test.tsx
git commit -m "feat(web): add weekly-repeat toggle to CreateBookingModal"
```

---

### Task 10: `CancelBookingDialog` — this-vs-series choice

**Files:**
- Modify: `apps/web/src/features/bookings/CancelBookingDialog.tsx`
- Create: `apps/web/src/features/bookings/CancelBookingDialog.test.tsx`

**Interfaces:**
- Produces: `CancelBookingDialogProps.onConfirm` changes from `() => Promise<void>` to `(scope?: 'series') => Promise<void>` — consumed by `RoomSchedulePage.tsx` in Task 11. The radio choice only renders when `booking.seriesId` is set.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/features/bookings/CancelBookingDialog.test.tsx` — this is the first test file for this component, so it needs its own render setup. Look at `CreateBookingModal.test.tsx`'s imports (`@testing-library/react`, `@testing-library/user-event`, `vitest`) and mirror them:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Booking } from '@booking/core';
import { CancelBookingDialog } from './CancelBookingDialog';

const SINGLE_BOOKING: Booking = {
  id: 'booking-1',
  roomId: 1,
  title: 'Одноразова подія',
  startsAt: new Date('2026-01-07T07:00:00.000Z'),
  endsAt: new Date('2026-01-07T08:00:00.000Z'),
  userId: 'user-1',
  userName: 'Іван',
  seriesId: null,
};

const SERIES_BOOKING: Booking = {
  ...SINGLE_BOOKING,
  id: 'booking-2',
  seriesId: 'series-1',
};

function baseProps(booking: Booking) {
  return {
    isOpen: true,
    booking,
    roomName: 'Переговорна 1',
    viewerZone: 'Europe/Kyiv',
    onClose: vi.fn(),
    isDeleting: false,
    error: null,
  };
}

describe('CancelBookingDialog', () => {
  it('renders nothing when isOpen is false', () => {
    const onConfirm = vi.fn();
    const { container } = render(<CancelBookingDialog {...baseProps(SINGLE_BOOKING)} isOpen={false} onConfirm={onConfirm} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onConfirm with no scope for a non-series booking, and shows no scope choice', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<CancelBookingDialog {...baseProps(SINGLE_BOOKING)} onConfirm={onConfirm} />);

    expect(screen.queryByLabelText('це бронювання')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('уся серія')).not.toBeInTheDocument();
  });

  it('shows a this-vs-series choice for a series booking, defaulting to "це бронювання"', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CancelBookingDialog {...baseProps(SERIES_BOOKING)} onConfirm={onConfirm} />);

    expect(screen.getByLabelText('це бронювання')).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Скасувати бронювання' }));

    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it('calls onConfirm with scope="series" when "уся серія" is selected', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CancelBookingDialog {...baseProps(SERIES_BOOKING)} onConfirm={onConfirm} />);

    await user.click(screen.getByLabelText('уся серія'));
    await user.click(screen.getByRole('button', { name: 'Скасувати бронювання' }));

    expect(onConfirm).toHaveBeenCalledWith('series');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run src/features/bookings/CancelBookingDialog.test.tsx`
Expected: FAIL — `Unable to find a label with text of: це бронювання` (the radio choice doesn't exist yet), and the `onConfirm` calls happen with no arguments (current signature is `() => Promise<void>`).

- [ ] **Step 3: Write the minimal implementation**

Edit `apps/web/src/features/bookings/CancelBookingDialog.tsx`:

```tsx
import type { Booking } from '@booking/core';
import { useState } from 'react';
import { DateTime } from 'luxon';
import { FormError } from '../../components/FormError';

export interface CancelBookingDialogProps {
  isOpen: boolean;
  booking: Booking | null;
  roomName: string;
  viewerZone: string;
  onConfirm: (scope?: 'series') => Promise<void>;
  onClose: () => void;
  isDeleting: boolean;
  error: string | null;
}

export function CancelBookingDialog({
  isOpen,
  booking,
  roomName,
  viewerZone,
  onConfirm,
  onClose,
  isDeleting,
  error,
}: CancelBookingDialogProps) {
  const [scope, setScope] = useState<'this' | 'series'>('this');

  if (!isOpen || !booking) {
    return null;
  }
```

Reset `scope` back to `'this'` whenever a different booking opens, so a stale choice from a previous dialog never carries over — add a small effect near the top of the component, right after the `useState` line (needs `useEffect` added to the import):

```tsx
import { useEffect, useState } from 'react';
```

```tsx
  useEffect(() => {
    setScope('this');
  }, [booking?.id]);
```

(Keep the existing `if (!isOpen || !booking) return null;` early return *after* the hooks, matching React's rules-of-hooks — hooks must run unconditionally on every render, so this reorders the existing early-return to sit below the two new hook calls, not above them.)

Add the radio choice into the JSX, inside the details `<div>` block (after the "Дата й час" row, before its closing `</div>`), only when the booking belongs to a series:

```tsx
          {booking.seriesId && (
            <div className="flex flex-col gap-s2 pt-s2 border-t border-outline-variant">
              <label className="flex items-center gap-s2 cursor-pointer">
                <input
                  type="radio"
                  name="cancel-scope"
                  value="this"
                  checked={scope === 'this'}
                  onChange={() => setScope('this')}
                  aria-label="це бронювання"
                />
                <span>Тільки це бронювання</span>
              </label>
              <label className="flex items-center gap-s2 cursor-pointer">
                <input
                  type="radio"
                  name="cancel-scope"
                  value="series"
                  checked={scope === 'series'}
                  onChange={() => setScope('series')}
                  aria-label="уся серія"
                />
                <span>Уся серія</span>
              </label>
            </div>
          )}
```

Update the confirm button's `onClick` to pass the scope:

```tsx
            onClick={() => void onConfirm(booking.seriesId && scope === 'series' ? 'series' : undefined)}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run src/features/bookings/CancelBookingDialog.test.tsx`
Expected: PASS, all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/bookings/CancelBookingDialog.tsx apps/web/src/features/bookings/CancelBookingDialog.test.tsx
git commit -m "feat(web): add this-vs-series cancel choice to CancelBookingDialog"
```

---

### Task 11: Wire it up — series creation into `RoomSchedulePage.tsx`

**Files:**
- Modify: `apps/web/src/features/rooms/RoomSchedulePage.tsx`

**Interfaces:**
- Consumes: `useCreateBookingSeries` (Task 8), `CreateBookingModal`'s `onSubmitSeries`/`isSubmittingSeries` (Task 9). `CancelBookingDialog`'s scoped `onConfirm` (Task 10) needs no wiring change here — `handleCancelConfirm` already matches its `(scope?: 'series') => Promise<void>` signature, fixed back in Task 8 Step 3.

- [ ] **Step 1: There is no new automated test for this task** — `RoomSchedulePage.tsx` has no existing dedicated unit test file (verify: `find apps/web/src/features/rooms -iname '*RoomSchedulePage*'`), and the components it wires together are already covered individually in Tasks 9–10. This wiring is proven by Task 12's live-stack proof (screenshot + psql). Note this explicitly in the commit message, consistent with Task 8's same narrow exception.

- [ ] **Step 2: Implement**

Edit `apps/web/src/features/rooms/RoomSchedulePage.tsx`. Update the import:

```ts
import { useCreateBooking, useCreateBookingSeries, useCancelBooking } from '../bookings/useBookingMutations';
```

Add the series mutation near the existing `createMutation`/`cancelMutation`:

```ts
  const createMutation = useCreateBooking(validRoomId, weekInfo.weekStartISO);
  const createSeriesMutation = useCreateBookingSeries(validRoomId, weekInfo.weekStartISO);
  const cancelMutation = useCancelBooking(validRoomId, weekInfo.weekStartISO);
```

Add a series submit handler, after `handleCreateSubmit`:

```ts
  const handleCreateSeriesSubmit = async (values: { title: string; startsAt: string; endsAt: string; occurrenceCount: number }) => {
    setServerFormError(null);
    setServerFieldErrors({});
    try {
      const result = await createSeriesMutation.mutateAsync({
        roomId: Number(validRoomId),
        title: values.title,
        startsAt: values.startsAt,
        endsAt: values.endsAt,
        occurrenceCount: values.occurrenceCount,
      });
      if (result.skipped.length > 0) {
        setServerFormError(`Створено ${result.created.length} з ${result.created.length + result.skipped.length} повторень — решта збігається з наявними бронюваннями.`);
      } else {
        setIsCreateOpen(false);
      }
    } catch (err) {
      const mapped = mapApiErrorToForm(err);
      setServerFieldErrors(mapped.fieldErrors);
      setServerFormError(mapped.formError);
    }
  };
```

Update the `CreateBookingModal` JSX usage to pass the two new props:

```tsx
      <CreateBookingModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        roomName={room?.name ?? 'Переговорна'}
        dateDisplayStr={selectedSlotInfo.dateDisplayStr}
        initialStartISO={selectedSlotInfo.initialStartISO}
        initialEndISO={selectedSlotInfo.initialEndISO}
        viewerZone={viewerZone}
        onSubmit={handleCreateSubmit}
        onSubmitSeries={handleCreateSeriesSubmit}
        isSubmitting={createMutation.isPending}
        isSubmittingSeries={createSeriesMutation.isPending}
        serverFormError={serverFormError}
        serverFieldErrors={serverFieldErrors}
        roomId={Number(validRoomId)}
        existingBookings={bookings}
      />
```

The `CancelBookingDialog` usage already passes `onConfirm={handleCancelConfirm}` — no change needed there, since `handleCancelConfirm` now matches the new `(scope?: 'series') => Promise<void>` signature `CancelBookingDialog` expects (Task 10).

- [ ] **Step 3: Run the full web unit suite**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: PASS — the type error from Task 8 Step 3 (`useCancelBooking`'s new object-shaped `mutateAsync` argument) is now resolved by this task's `handleCancelConfirm` update; every existing web test (including `Phase5.test.tsx`, `Phase7Mobile.test.tsx`, `WeekGridStates.test.tsx`) stays green.

- [ ] **Step 4: Run the full root unit suite with Docker stopped**

Run (repo root): `npm test`
Expected: PASS, all three workspaces green, no database required.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/rooms/RoomSchedulePage.tsx
git commit -m "feat(web): wire weekly-repeat create and scoped cancel into RoomSchedulePage"
```

---

### Task 12: Final verification — clean-clone proof, live-stack proof, screenshot

**Files:** none (verification only).

- [ ] **Step 1: Full clean-clone Docker verification**

```bash
docker compose down -v   # -v: also drop the Postgres volume, for a truly clean clone simulation
docker compose up --build
```

Expected: Postgres healthcheck green before the API starts, migrations run (including this plan's new one), 6 seeded rooms, no crash loop. Watch the logs to completion (`Ctrl+C` once the API reports it's listening, or run with `-d` and `docker compose logs -f api`).

- [ ] **Step 2: Re-run both suites and diff against Task 0's baseline**

```bash
npm test                    # Docker can be up or down for this one — it must not matter
docker compose down && docker compose up -d
npm run test:integration
```

Expected: `npm test` count identical to Task 0's baseline (no unit test was removed, only added — actually this plan adds tests, so counts should be strictly *higher*, never lower or equal-with-different-names). `npm run test:integration` count is Task 0's baseline **+ 6** (tests 19–24 from Task 7).

- [ ] **Step 3: Confirm the EXCLUDE constraint and Phase 3's own acceptance check are both intact**

```bash
docker compose exec postgres psql -U booking -d booking -c '\d bookings'
```

Expected: `bookings_no_overlap` still present, `USING gist (room_id WITH =, tstzrange(starts_at, ends_at, '[)'::text) WITH &&) WHERE (canceled_at IS NULL)`, byte-for-byte the same predicate as before this plan started.

Re-run Phase 3's own literal acceptance check — two parallel identical POSTs to the single-booking endpoint must still produce exactly one row (this is integration test 4 in `bookings.int-spec.ts`, already re-run in Step 2, but confirm explicitly by name):

```bash
npx jest --config apps/api/test/jest-integration.json --runInBand -t "Two concurrent identical POSTs"
```

Expected: 1 passing test.

- [ ] **Step 4: Live proof — partial conflict, cancel one, cancel the rest, via curl + psql**

With the stack from Step 1 still running, register a user and grab their session cookie:

```bash
curl -i -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Proof User","email":"proof@example.com","password":"Password123!"}'
```

Mark them verified directly (dev-only shortcut, mirroring what `createUser()` does in the integration suite):

```bash
docker compose exec postgres psql -U booking -d booking -c \
  "update users set email_verified_at = now() where email = 'proof@example.com';"
```

Create a blocking booking on a future Tuesday that will collide with occurrence 2 of the series about to be created — pick real near-future dates when running this (the plan can't hardcode a date that stays in the future; compute "next Tuesday" and "the Tuesday after" relative to whenever this step actually runs):

```bash
curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/bookings \
  -H 'Content-Type: application/json' \
  -d '{"roomId":1,"title":"Blocker","startsAt":"<NEXT_NEXT_TUESDAY>T07:00:00.000Z","endsAt":"<NEXT_NEXT_TUESDAY>T08:00:00.000Z"}'
```

Create the series (occurrence 1 = next Tuesday 10:00 Kyiv, 4 occurrences weekly — occurrence 2 collides with the blocker above):

```bash
curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/bookings/series \
  -H 'Content-Type: application/json' \
  -d '{"roomId":1,"title":"Weekly Sync Proof","startsAt":"<NEXT_TUESDAY>T07:00:00.000Z","endsAt":"<NEXT_TUESDAY>T08:00:00.000Z","occurrenceCount":4}' | tee /tmp/series-response.json
```

Expected in the response: `created` has 3 entries, `skipped` has 1.

Show the resulting rows from psql:

```bash
docker compose exec postgres psql -U booking -d booking -c \
  "select id, title, starts_at, series_id, canceled_at from bookings where title = 'Weekly Sync Proof' order by starts_at;"
docker compose exec postgres psql -U booking -d booking -c \
  "select * from booking_series;"
```

Cancel one occurrence (use the first `id` from the `created` array in `/tmp/series-response.json`):

```bash
FIRST_ID=$(node -e "console.log(require('/tmp/series-response.json').created[0].id)")
curl -s -b /tmp/cookies.txt -X DELETE "http://localhost:3000/api/bookings/$FIRST_ID"
```

Cancel the rest of the series (use the second `id`, scope=series):

```bash
SECOND_ID=$(node -e "console.log(require('/tmp/series-response.json').created[1].id)")
curl -s -b /tmp/cookies.txt -X DELETE "http://localhost:3000/api/bookings/$SECOND_ID?scope=series"
```

Show the final rows from psql:

```bash
docker compose exec postgres psql -U booking -d booking -c \
  "select id, title, starts_at, series_id, canceled_at from bookings where title = 'Weekly Sync Proof' order by starts_at;"
```

Expected: all 3 `created` rows now have a non-null `canceled_at`; the `booking_series` row from the earlier query still exists (never deleted).

- [ ] **Step 5: Screenshot the UI reflecting the same state — including a cross-week cache check**

Open `http://localhost:5173` (or wherever `npm run dev:web` serves, or the built SPA on `http://localhost:3000` if testing the production build), log in as `proof@example.com`, navigate to room 1's schedule for the relevant week, and capture a screenshot showing the (now-cancelled) series slots as free again. If any series occurrence was left live for the screenshot instead (recommended, so the screenshot shows something more interesting than an empty grid) — repeat Step 4's series-creation call with a fresh title, cancel *only one* occurrence, and screenshot the week grid showing the remaining live occurrences plus the freed slot from the one cancelled occurrence, then separately screenshot the "cancel" dialog's this-vs-series radio choice open on one of the remaining occurrences.

Then specifically verify Task 8's cache-invalidation fix: create one more series with `occurrenceCount` at least 3, note which weeks its occurrences fall in (a 3-occurrence weekly series spans 3 different Monday-start weeks unless the anchor day is a Monday), cancel the whole series via `?scope=series` while the grid is showing week 1, then click "next week" in the UI (no manual page reload) and confirm week 2's occurrence is shown as cancelled/free without a refresh — this is the exact bug the prefix-based `invalidateQueries` fix in Task 8 exists to prevent, and it is the one thing in this plan that only a real browser session can prove.

- [ ] **Step 6: Tear down**

```bash
docker compose down
```

- [ ] **Step 7: Final commit (if any cleanup was needed) and summary**

If Steps 1–6 required no code changes (expected — this task is verification only), there is nothing to commit. Report to the user: baseline vs. final test counts, confirmation the EXCLUDE constraint is untouched, and the screenshot(s) from Step 5.

---

## Self-Review

**Spec coverage:**
- `booking_series` table, `bookings.series_id` (SPEC §1) → Task 3.
- `DELETE /api/bookings/:id?scope=series` (SPEC §4) → Task 6.
- "every Tuesday, 8 occurrences", cancel one or the whole series (brief §05) → Tasks 5, 6, 9, 10, 11; the "8" is the default in the UI (Task 9) but user-configurable 2–52 (Task 2).
- `npm test` green with no database (SPEC §5 standing rule) → checked at the end of Tasks 6, 11, and again in Task 12.
- DST safety across the series → Task 1, with an explicit test crossing the last Sunday of March.
- Ownership-before-state-leak ordering on cancel → Task 5 (`cancelSeries`), mirroring the existing `cancel`.
- No orphan `booking_series` row → Task 5 (`createSeries`'s `deleteBookingSeries` fallback), proven in Task 7 integration test 21.
- Race protection / EXCLUDE constraint unmodified → explicitly checked in Task 3 Step 3 and again in Task 12 Step 3.
- Ukrainian UI strings, English code → every new user-facing string in Tasks 2, 5, 9, 10 is Ukrainian; every identifier/comment is English.

**Placeholder scan:** no "TBD"/"handle edge cases"/"similar to Task N" left in any step; every code step is a complete, pasteable block.

**Type consistency:** `BookingRow.seriesId: string | null` (Task 4) flows unchanged into `CreateSeriesResult.created: BookingRow[]` (Task 5) and the controller's response (Task 6). `weeklyOccurrences`'s return shape `{ startsAt: Date; endsAt: Date }[]` (Task 1) matches exactly what `createSeries` iterates over (Task 5) and what the service spec's assertions expect. `BookingOwnershipAndSeries` (Task 4) is the same shape consumed by `cancelSeries` (Task 5) and constructed by both the Drizzle implementation and the controller spec's `RecordingBookingsRepository` (Tasks 4 and 6). `CreateBookingSeriesInput` (Task 2) is the exact parameter type `BookingsService.createSeries` accepts (Task 5) and what `parseOrThrow(CreateBookingSeriesSchema, body)` produces in the controller (Task 6).
