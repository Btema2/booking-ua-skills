# Phase 6 — My Bookings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 6 — "My bookings" page with upcoming/past tabs, cancellation for upcoming bookings, URL-synced active tab/page state, Kyiv week navigation, viewer timezone formatting, and full API and unit/integration test coverage.

**Architecture:** Extend `@booking/core` with `MyBookingsQuerySchema` and week calculation helpers. Add a custom Drizzle migration for `bookings(user_id)` index in `apps/api`. Implement `GET /api/bookings/mine` in NestJS with full Jest testing. In `apps/web`, enable `/my-bookings` in `NavBar.tsx`, build `MyBookingsPage.tsx` with max width 1000px (`--page-max-narrow`), reuse Phase 5's `CancelBookingDialog`, and write Vitest tests.

**Tech Stack:** NestJS 11, Drizzle ORM, Postgres 18, Zod, React 19, React Router 7/8, TanStack Query 5, Luxon 3, Vitest, Jest.

## Global Constraints

- **DB Migration:** Custom migration via `drizzle-kit generate --custom`. NEVER `drizzle-kit push`.
- **Timezone:** All timestamps stored in UTC. View times rendered in viewer's zone per instant using Luxon. Week parameter for `/rooms/:roomId?week=YYYY-MM-DD` calculated in `Europe/Kyiv` Monday start of week.
- **Language:** UI strings Ukrainian. Code/identifiers/comments English.
- **Page Max Width:** `1000px` (`--page-max-narrow`) for `/my-bookings`.

---

### Task 1: Core Zod Schemas & Domain Helpers (`packages/core`)

**Files:**
- Modify: `packages/core/src/schemas/booking.ts`
- Modify: `packages/core/src/domain/week-slots.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/schemas/booking.test.ts`
- Test: `packages/core/src/domain/week-slots.test.ts`

**Interfaces:**
- Produces: `MyBookingsQuerySchema`, `MyBookingsQuery`, `MyBookingRow`, `getKyivWeekParamForInstant(instant: Date | string): string`

- [ ] **Step 1: Write the failing tests**

In `packages/core/src/schemas/booking.test.ts` and `packages/core/src/domain/week-slots.test.ts`:
- Add test for `MyBookingsQuerySchema`: validates `status` (`'upcoming' | 'past'`), `page` (default 1, positive int), `limit` (default 10).
- Add test for `getKyivWeekParamForInstant`:
  - 30 December booking where week starts in previous year (e.g. 2020-12-30 -> '2020-12-28' or 2025-12-30 -> '2025-12-29').
  - Month boundary crossing (e.g. 2026-09-01 -> '2026-08-31').

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=packages/core`
Expected: FAIL with "MyBookingsQuerySchema is not exported / getKyivWeekParamForInstant is not defined".

- [ ] **Step 3: Write minimal implementation**

Implement `MyBookingsQuerySchema` in `packages/core/src/schemas/booking.ts`:
```ts
export const MyBookingsQuerySchema = z.object({
  status: z.enum(['upcoming', 'past'], { error: 'Некоректний статус' }),
  page: z.coerce.number().int().positive({ error: 'Некоректна сторінка' }).default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});
export type MyBookingsQuery = z.infer<typeof MyBookingsQuerySchema>;
```
Implement `getKyivWeekParamForInstant` in `packages/core/src/domain/week-slots.ts`:
```ts
export function getKyivWeekParamForInstant(startsAt: Date | string): string {
  const dt = typeof startsAt === 'string'
    ? DateTime.fromISO(startsAt, { zone: 'utc' }).setZone(OFFICE_ZONE)
    : DateTime.fromJSDate(startsAt, { zone: 'utc' }).setZone(OFFICE_ZONE);
  return dt.startOf('week').toFormat('yyyy-MM-dd');
}
```
Export them from `packages/core/src/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --workspace=packages/core`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): add MyBookingsQuerySchema and getKyivWeekParamForInstant helper"
```

---

### Task 2: Database Migration & Repository (`apps/api`)

**Files:**
- Create: `apps/api/drizzle/0002_add_bookings_user_id_idx.sql`
- Modify: `apps/api/src/bookings/bookings.repository.ts`
- Modify: `apps/api/src/bookings/drizzle-bookings.repository.ts`

**Interfaces:**
- Consumes: `MyBookingsQuery`
- Produces: `MyBookingRow`, `BookingsRepository.listMyBookings(userId: string, status: 'upcoming' | 'past', page: number, limit: number)`

- [ ] **Step 1: Create custom migration for index**

Create `apps/api/drizzle/0002_add_bookings_user_id_idx.sql`:
```sql
CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings (user_id);
```

- [ ] **Step 2: Add interface and implementation for listMyBookings**

In `apps/api/src/bookings/bookings.repository.ts`:
```ts
export interface MyBookingRow {
  id: string;
  roomId: number;
  roomName: string;
  roomFloor: number;
  title: string;
  startsAt: Date;
  endsAt: Date;
  userId: string;
  userName: string;
}

export interface PaginatedMyBookings {
  bookings: MyBookingRow[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export abstract class BookingsRepository {
  // ...
  abstract listMyBookings(userId: string, status: 'upcoming' | 'past', page: number, limit: number): Promise<PaginatedMyBookings>;
}
```

In `apps/api/src/bookings/drizzle-bookings.repository.ts`:
Implement `listMyBookings`:
- Filter `bookings.userId = userId` AND `isNull(bookings.canceledAt)`.
- If `status === 'upcoming'`: `gt(bookings.endsAt, sql\`now()\`)`, order `asc(bookings.startsAt)`.
- If `status === 'past'`: `lte(bookings.endsAt, sql\`now()\`)`, order `desc(bookings.startsAt)`.
- Join `rooms` on `rooms.id = bookings.roomId` to select `roomName: rooms.name` and `roomFloor: rooms.floor`.
- Compute total count, return slice for `(page - 1) * limit`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/drizzle apps/api/src/bookings
git commit -m "feat(api): add bookings_user_id_idx migration and listMyBookings repository method"
```

---

### Task 3: Controller, Service & Jest Tests (`apps/api`)

**Files:**
- Modify: `apps/api/src/bookings/bookings.service.ts`
- Modify: `apps/api/src/bookings/bookings.controller.ts`
- Test: `apps/api/src/bookings/bookings.controller.spec.ts`
- Test: `apps/api/src/bookings/bookings.service.spec.ts`

**Interfaces:**
- Produces: `GET /api/bookings/mine?status=upcoming|past&page=`

- [ ] **Step 1: Write failing Jest tests for GET /api/bookings/mine**

In `apps/api/src/bookings/bookings.controller.spec.ts` or `bookings.service.spec.ts`:
Test scenarios:
- `upcoming` status excludes past and cancelled bookings.
- `past` status excludes upcoming and cancelled bookings.
- ordering is `asc` for upcoming and `desc` for past.
- pagination returns the right slice (`page=1, limit=2`, etc.).
- one user cannot see another user's rows.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=apps/api`
Expected: FAIL with missing method/route.

- [ ] **Step 3: Implement service method and controller endpoint**

In `apps/api/src/bookings/bookings.service.ts`:
```ts
async listMine(user: PublicUser, query: MyBookingsQuery): Promise<PaginatedMyBookings> {
  return this.bookingsRepo.listMyBookings(user.id, query.status, query.page, query.limit);
}
```

In `apps/api/src/bookings/bookings.controller.ts`:
```ts
@Get('mine')
async listMine(@Query() queryParams: unknown, @CurrentUser() user: PublicUser): Promise<PaginatedMyBookings> {
  const query = parseOrThrow(MyBookingsQuerySchema, queryParams);
  return this.bookings.listMine(user, query);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --workspace=apps/api`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/bookings
git commit -m "feat(api): implement GET /api/bookings/mine endpoint with tests"
```

---

### Task 4: Frontend Components, Route & Vitest Tests (`apps/web`)

**Files:**
- Modify: `apps/web/src/components/NavBar.tsx`
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/src/features/bookings/MyBookingsPage.tsx`
- Create: `apps/web/src/features/bookings/MyBookingsPage.test.tsx`

**Interfaces:**
- Produces: `/my-bookings` route with `«Майбутні»` and `«Минулі»` tabs, cancel dialog, row navigation, pagination, empty/loading/error states.

- [ ] **Step 1: Write failing Vitest tests**

In `apps/web/src/features/bookings/MyBookingsPage.test.tsx`:
Implement all 6 required Vitest tests:
1. Upcoming and past tabs render their own rows and active tab survives a page reload (via URL `?tab=past`).
2. Times render in viewer's zone; assert row's label differs between `Europe/Warsaw` and `Asia/Tokyo`.
3. Clicking a row builds `/rooms/:id?week=YYYY-MM-DD` URL, including 30 Dec booking where week starts in previous year, and month boundary crossing.
4. Cancel on upcoming row opens Phase 5 dialog, removes row optimistically, and rejected DELETE restores it.
5. Past rows expose no cancel control.
6. Empty state renders and its button navigates to room list.

- [ ] **Step 2: Run Vitest to verify tests fail**

Run: `npm test --workspace=apps/web`
Expected: FAIL (MyBookingsPage not implemented yet).

- [ ] **Step 3: Implement MyBookingsPage and enable navbar link**

1. In `apps/web/src/components/NavBar.tsx`: enable `/my-bookings` tab.
2. In `apps/web/src/App.tsx`: add `<Route path="/my-bookings" element={<MyBookingsPage />} />`.
3. In `apps/web/src/features/bookings/MyBookingsPage.tsx`:
   - Styled to `max-w-[1000px] mx-auto` (`--page-max-narrow`).
   - Query `/api/bookings/mine?status=${tab}&page=${page}` using TanStack Query.
   - Skeletons on loading: 2 shimmering row skeletons (40px leading square + 2 bars).
   - Error: «Не вдалося оновити список», show cached copy, cancel disabled.
   - Empty: secondary-container calendar circle, «Майбутніх бронювань немає» / «Минулих бронювань немає», primary pill «Обрати кімнату».
   - Upcoming rows: cancel button opening `CancelBookingDialog` and using `useCancelBooking`.
   - Past rows: no cancel button.
   - Row click: navigates to `/rooms/${row.roomId}?week=${getKyivWeekParamForInstant(row.startsAt)}`.

- [ ] **Step 4: Run Vitest to verify tests pass**

Run: `npm test --workspace=apps/web`
Expected: PASS

- [ ] **Step 5: Run full test suite & build**

Run: `npm test && npm run build`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): implement My Bookings page with tabs, cancel dialog, navigation and tests"
```
