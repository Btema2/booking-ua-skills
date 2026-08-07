# Atomic Recurring Bookings & Conflict Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change recurring booking creation to be fully atomic (deny all if ANY occurrence overlaps), return a clear 409 Conflict error with formatted Ukrainian details, save a notification to the bell menu, and display the error in the booking modal prompt.

**Architecture:** Update database schema migration to allow `notifications.booking_id` to be nullable and add a `message` column. Update `BookingsService.createSeries` to check for overlaps within a single DB transaction, formatting the 409 error message (`1 overlap` vs `>1 overlaps`) and persisting a `series_conflict` notification. Update `NotificationBell` and `CreateBookingModal` on the frontend to render the new notification and error prompt.

**Tech Stack:** NestJS 11, Drizzle ORM (PostgreSQL), Zod, Luxon 3, React 19, React Query 5.

## Global Constraints

- Never use `drizzle-kit push`. Use `drizzle-kit generate` or hand-crafted migration SQL applied via `migrate()`.
- Store timestamps in UTC; format in `Europe/Kyiv` zone or viewer timezone using Luxon 3.
- No partial series creation allowed — 0 created if any conflict exists.

---

### Task 1: Database Schema & Notification Repository Updates

**Files:**
- Create: `apps/api/drizzle/0010_series_conflict_notifications.sql`
- Modify: `apps/api/src/db/schema.ts`
- Modify: `apps/api/src/notifications/notifications.repository.ts`
- Modify: `apps/api/src/notifications/drizzle-notifications.repository.ts`
- Test: `apps/api/src/notifications/drizzle-notifications.repository.spec.ts`

**Interfaces:**
- Consumes: Existing `notifications` Drizzle schema and `NotificationsRepository`
- Produces: Nullable `bookingId` and `message` column on `notifications`, `createConflictNotification(userId, message)` on `NotificationsRepository`, `listForUser` supporting `leftJoin` for null `bookingId`.

- [ ] **Step 1: Write failing unit test for `DrizzleNotificationsRepository` with nullable `bookingId`**

Edit `apps/api/src/notifications/drizzle-notifications.repository.spec.ts` to test saving and listing a notification with `bookingId = null` and a custom `message`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest apps/api/src/notifications/drizzle-notifications.repository.spec.ts`
Expected: FAIL due to missing `message` field and `notNull()` on `bookingId`.

- [ ] **Step 3: Add Migration `0010_series_conflict_notifications.sql` and update Drizzle schema**

Create `apps/api/drizzle/0010_series_conflict_notifications.sql`:
```sql
ALTER TABLE "notifications" ALTER COLUMN "booking_id" DROP NOT NULL;
ALTER TABLE "notifications" ADD COLUMN "message" text;
```
Update `apps/api/src/db/schema.ts`:
```ts
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookingId: uuid('booking_id')
      .references(() => bookings.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    message: text('message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('notifications_once').on(table.bookingId, table.kind)],
);
```

- [ ] **Step 4: Update `NotificationsRepository` and `DrizzleNotificationsRepository`**

Update `NotificationRow` interface:
```ts
export interface NotificationRow {
  id: string;
  bookingId: string | null;
  kind: string;
  message: string | null;
  createdAt: Date;
  readAt: Date | null;
  bookingTitle: string | null;
  bookingEndsAt: Date | null;
  roomId: number | null;
  roomName: string | null;
}
```
Add `createConflictNotification(userId: string, message: string): Promise<boolean>` method to `NotificationsRepository`.
Update `DrizzleNotificationsRepository.listForUser` to use `leftJoin` on `bookings` and `rooms`:
```ts
  async listForUser(userId: string, limit: number): Promise<NotificationRow[]> {
    return runQuery('listNotificationsForUser', () =>
      this.db
        .select({
          id: notifications.id,
          bookingId: notifications.bookingId,
          kind: notifications.kind,
          message: notifications.message,
          createdAt: notifications.createdAt,
          readAt: notifications.readAt,
          bookingTitle: bookings.title,
          bookingEndsAt: bookings.endsAt,
          roomId: rooms.id,
          roomName: rooms.name,
        })
        .from(notifications)
        .leftJoin(bookings, eq(bookings.id, notifications.bookingId))
        .leftJoin(rooms, eq(rooms.id, bookings.roomId))
        .where(eq(notifications.userId, userId))
        .orderBy(desc(sql`${notifications.readAt} is null`), desc(notifications.createdAt))
        .limit(limit),
    );
  }
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npx jest apps/api/src/notifications/drizzle-notifications.repository.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/drizzle apps/api/src/db/schema.ts apps/api/src/notifications
git commit -m "feat(db): update notifications schema to support series conflict alerts"
```

---

### Task 2: Atomic Series Creation & Conflict Handling in Backend Service

**Files:**
- Modify: `apps/api/src/bookings/bookings.repository.ts`
- Modify: `apps/api/src/bookings/drizzle-bookings.repository.ts`
- Modify: `apps/api/src/bookings/bookings.service.ts`
- Modify: `apps/api/src/bookings/bookings.errors.ts`
- Modify: `apps/api/src/bookings/bookings.service.spec.ts`
- Modify: `apps/api/test/bookings.int-spec.ts`

**Interfaces:**
- Consumes: `NotificationsRepository.createConflictNotification`, `BookingsRepository.findOverlappingBookings`
- Produces: Atomic `BookingsService.createSeries` throwing `409 Conflict` with Ukrainian conflict message on ANY overlap.

- [ ] **Step 1: Write failing unit test in `bookings.service.spec.ts` for atomic creation & conflict error message**

Add tests for:
1. Single overlap -> throws ConflictException with `"Не вдалося створити повторювані зустрічі: конфліктує з зустріччю «...» (...). Будь ласка виберіть інший час"`.
2. Multiple overlaps -> throws ConflictException with `"Не вдалося створити повторювані зустрічі: конфліктує з N зустрічами"`.
3. 0 overlaps -> creates all N bookings.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest apps/api/src/bookings/bookings.service.spec.ts`
Expected: FAIL (currently skips overlaps and creates partial series).

- [ ] **Step 3: Implement `findOverlappingBookings` in Repository and atomic `createSeries` in Service**

In `BookingsRepository`:
Add method `findOverlappingBookings(roomId: number, occurrences: { startsAt: Date; endsAt: Date }[])`.
In `DrizzleBookingsRepository`:
Query DB for active bookings in `roomId` overlapping any occurrence: `isNull(canceledAt) AND (startsAt < occ.endsAt AND endsAt > occ.startsAt)`.

In `BookingsService`:
Inject `NotificationsRepository`.
Update `createSeries`:
- Validate input for all occurrences.
- Query overlapping bookings for all occurrences.
- If `overlappingBookings.length > 0`:
  - Format conflict error message:
    - 1 overlap: `"Не вдалося створити повторювані зустрічі: конфліктує з зустріччю «" + title + "» (" + formattedDate + " " + formattedTimeRange + "). Будь ласка виберіть інший час"`
    - >1 overlaps: `"Не вдалося створити повторювані зустрічі: конфліктує з " + count + " зустрічами"`
  - Create conflict notification: `this.notificationsRepo.createConflictNotification(user.id, errorMessage)`
  - Throw `seriesConflict(errorMessage)` (409 ConflictException).
- If 0 overlaps:
  - Create `booking_series` and all N bookings inside transaction.
  - Return `{ series: { id }, created }`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest apps/api/src/bookings/bookings.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Update Integration Tests in `apps/api/test/bookings.int-spec.ts`**

Update `bookings.int-spec.ts` series creation tests to assert that partial creation returns 409 Conflict, 0 bookings are saved in DB, and a `series_conflict` notification is present in `/api/notifications`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/bookings apps/api/test/bookings.int-spec.ts
git commit -m "feat(api): enforce atomic series creation and conflict notifications"
```

---

### Task 3: Web Frontend Notification Bell & Booking Modal Prompt

**Files:**
- Modify: `apps/web/src/features/notifications/api.ts`
- Modify: `apps/web/src/features/notifications/NotificationBell.tsx`
- Modify: `apps/web/src/features/notifications/NotificationBell.test.tsx`
- Modify: `apps/web/src/features/bookings/CreateBookingModal.tsx`
- Modify: `apps/web/src/features/bookings/CreateBookingModal.test.tsx`
- Modify: `apps/web/src/features/bookings/useBookingMutations.ts`
- Modify: `apps/web/src/features/rooms/RoomSchedulePage.tsx`

**Interfaces:**
- Consumes: `NotificationDTO` with optional `message` and `kind = 'series_conflict'`, `POST /api/bookings/series` returning 409 error message.
- Produces: Bell rendering `series_conflict` notifications, modal displaying 409 error prompt, invalidating notification queries on mutation completion.

- [ ] **Step 1: Write failing test in `NotificationBell.test.tsx` for `series_conflict` notification**

Add test checking that a notification with `kind: 'series_conflict'` renders title `"Не вдалося створити повторювані зустрічі"` and the detailed message body.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/src/features/notifications/NotificationBell.test.tsx`
Expected: FAIL

- [ ] **Step 3: Update `NotificationBell.tsx` and `api.ts`**

Update `NotificationDTO`:
```ts
export interface NotificationDTO {
  id: string;
  bookingId: string | null;
  kind: string;
  message: string | null;
  createdAt: string;
  readAt: string | null;
  bookingTitle: string | null;
  bookingEndsAt: string | null;
  roomId: number | null;
  roomName: string | null;
}
```
In `NotificationBell.tsx`:
Handle `n.kind === 'series_conflict'`:
- Title: `"Не вдалося створити повторювані зустрічі"`
- Body: `n.message ?? ''`
- Icon: Warning icon (alert circle / triangle).

- [ ] **Step 4: Update `useBookingMutations.ts`, `CreateBookingModal.tsx`, and `RoomSchedulePage.tsx`**

In `useBookingMutations.ts`:
In `useCreateBookingSeries`, add `onSettled`:
`queryClient.invalidateQueries({ queryKey: ['notifications', 'mine'] })`.

In `RoomSchedulePage.tsx`:
Remove `seriesPartialMessage` state and banner rendering (since partial creation is replaced with atomic rejection).

- [ ] **Step 5: Run frontend tests to verify pass**

Run: `npm test` at workspace root or `npx vitest run` in `apps/web`.
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): update notification bell and create booking modal for atomic series conflicts"
```
