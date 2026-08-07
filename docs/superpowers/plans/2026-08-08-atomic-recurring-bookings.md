# Atomic Recurring Bookings & Conflict Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change recurring booking creation to be fully atomic (deny all if ANY occurrence overlaps), return a clear 409 Conflict error with formatted Ukrainian details and `conflictsCount`, save a notification to the bell menu, and display the exact error in the booking modal prompt.

**Architecture:** Update database schema migration to allow `notifications.booking_id` to be nullable and add a `message` column. Update `BookingsService.createSeries` to check for overlaps, format the 409 error message (`1 overlap` vs `>1 overlaps`), persist a `series_conflict` notification outside the booking transaction, and throw a `409 ConflictException` with `conflictsCount`. Update `errorMapping.ts`, `NotificationBell`, and `CreateBookingModal` on the frontend.

**Tech Stack:** NestJS 11, Drizzle ORM (PostgreSQL), Zod, Luxon 3, React 19, React Query 5.

## Global Constraints

- Never use `drizzle-kit push`. Use `drizzle-kit generate` or hand-crafted migration SQL applied via `migrate()`.
- Store timestamps in UTC; format in `Europe/Kyiv` zone or viewer timezone using Luxon 3.
- No partial series creation allowed — 0 created if any conflict exists. Remove `skipped` from `CreateSeriesResult` and `BookingSeriesResult`.

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
Add `createConflictNotification(userId: string, message: string): Promise<boolean>` method to `NotificationsRepository` and implement in `DrizzleNotificationsRepository` using `runQuery('createConflictNotification', ...)` with `kind: 'series_conflict'`.

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
- Produces: `CreateSeriesResult` (`{ series: { id }, created: BookingRow[] }`), `seriesConflict(message, conflictsCount)` helper, atomic `BookingsService.createSeries` throwing `409 ConflictException` with `message` and `conflictsCount` on ANY overlap.

- [ ] **Step 1: Update `bookings.errors.ts` and `CreateSeriesResult` interface**

In `apps/api/src/bookings/bookings.errors.ts`:
Remove `allOccurrencesTaken`. Add `seriesConflict`:
```ts
export function seriesConflict(message: string, conflictsCount: number): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    message,
    conflictsCount,
  });
}
```
In `apps/api/src/bookings/bookings.service.ts`:
Update `CreateSeriesResult` to remove `skipped`:
```ts
export interface CreateSeriesResult {
  series: { id: string };
  created: BookingRow[];
}
```

- [ ] **Step 2: Write failing unit test in `bookings.service.spec.ts` for atomic creation & conflict error message**

Add unit tests in `bookings.service.spec.ts`:
1. Single overlap -> calls `createConflictNotification`, throws ConflictException with `message: "Не вдалося створити повторювані зустрічі: конфліктує з зустріччю «...» (dd.MM.yyyy HH:mm–HH:mm). Будь ласка виберіть інший час"` and `conflictsCount: 1`. No bookings created.
2. Multiple overlaps -> calls `createConflictNotification`, throws ConflictException with `message: "Не вдалося створити повторювані зустрічі: конфліктує з 2 зустрічами"` and `conflictsCount: 2`. No bookings created.
3. 0 overlaps -> creates all N bookings.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest apps/api/src/bookings/bookings.service.spec.ts`
Expected: FAIL

- [ ] **Step 4: Implement `findOverlappingBookings` in Repository and atomic `createSeries` in Service**

In `BookingsRepository`:
Add method `findOverlappingBookings(roomId: number, occurrences: { startsAt: Date; endsAt: Date }[])`.
In `DrizzleBookingsRepository`:
Use `runQuery('findOverlappingBookings', ...)` to query active bookings in `roomId` overlapping any occurrence: `isNull(canceledAt) AND roomId = roomId AND (startsAt < occ.endsAt AND endsAt > occ.startsAt)`.

In `BookingsService`:
Inject `NotificationsRepository`.
Update `createSeries`:
- Validate input for all occurrences.
- Query overlapping bookings for all occurrences.
- If `overlappingBookings.length > 0`:
  - Format conflict error message:
    - If `overlappingBookings.length === 1`:
      - Use Luxon to convert `overlappingBookings[0].startsAt` and `endsAt` to `Europe/Kyiv`:
        - `formattedDate`: `dd.MM.yyyy`
        - `formattedTimeRange`: `HH:mm–HH:mm`
      - `details`: `«${booking.title}» (${formattedDate} ${formattedTimeRange})`
      - `errorMessage`: `"Не вдалося створити повторювані зустрічі: конфліктує з зустріччю " + details + ". Будь ласка виберіть інший час"`
    - If `overlappingBookings.length > 1`:
      - `errorMessage`: `"Не вдалося створити повторювані зустрічі: конфліктує з " + count + " зустрічами"`
  - Create conflict notification **outside/before** any booking creation:
    `await this.notificationsRepo.createConflictNotification(user.id, errorMessage)`
  - Throw `seriesConflict(errorMessage, overlappingBookings.length)`.
- If 0 overlaps:
  - Create `booking_series` and all N bookings inside transaction.
  - Return `{ series: { id }, created }`.

- [ ] **Step 5: Run unit tests to verify pass**

Run: `npx jest apps/api/src/bookings/bookings.service.spec.ts`
Expected: PASS

- [ ] **Step 6: Update Integration Tests in `apps/api/test/bookings.int-spec.ts`**

Update `bookings.int-spec.ts` series creation tests to assert that overlapping creation returns 409 Conflict with `conflictsCount` and `message`, 0 bookings are saved in DB, and a `series_conflict` notification is returned by GET `/api/notifications`.

- [ ] **Step 7: Run integration tests to verify pass**

Run: `npx jest apps/api/test/bookings.int-spec.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/bookings apps/api/test/bookings.int-spec.ts
git commit -m "feat(api): enforce atomic series creation and conflict notifications"
```

---

### Task 3: Web Frontend Error Mapping, Notification Bell & Booking Modal Prompt

**Files:**
- Modify: `apps/web/src/features/bookings/errorMapping.ts`
- Modify: `apps/web/src/features/notifications/api.ts`
- Modify: `apps/web/src/features/notifications/NotificationBell.tsx`
- Modify: `apps/web/src/features/notifications/NotificationBell.test.tsx`
- Modify: `apps/web/src/features/bookings/CreateBookingModal.tsx`
- Modify: `apps/web/src/features/bookings/CreateBookingModal.test.tsx`
- Modify: `apps/web/src/features/bookings/useBookingMutations.ts`
- Modify: `apps/web/src/features/rooms/RoomSchedulePage.tsx`

**Interfaces:**
- Consumes: `NotificationDTO` with optional `message` and `kind = 'series_conflict'`, `POST /api/bookings/series` returning 409 error message.
- Produces: `errorMapping.ts` forwarding custom 409 message to `formError`, `NotificationBell` rendering `series_conflict` notifications, `useCreateBookingSeries` invalidating `['notifications']` query key.

- [ ] **Step 1: Update `errorMapping.ts` to preserve custom 409 messages**

In `apps/web/src/features/bookings/errorMapping.ts`:
Update `mapApiErrorToForm`:
```ts
if (status === 409) {
  return {
    fieldErrors: {},
    formError: err instanceof ApiError ? err.message : BOOKING_REJECTION_MESSAGES.slotTaken,
  };
}
```

- [ ] **Step 2: Write failing test in `NotificationBell.test.tsx` for `series_conflict` notification**

Add test checking that a notification with `kind: 'series_conflict'`, `bookingId: null`, and `message` renders title `"Не вдалося створити повторювані зустрічі"` and the detailed message body, without crashing on missing booking fields.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run apps/web/src/features/notifications/NotificationBell.test.tsx`
Expected: FAIL

- [ ] **Step 4: Update `NotificationBell.tsx` and `api.ts`**

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
Conditionally check `n.kind`:
- If `n.kind === 'series_conflict'`:
  - Title: `"Не вдалося створити повторювані зустрічі"`
  - Body: `n.message ?? ''`
  - Icon: Warning icon (alert triangle / circle with exclamation mark).
- Else (`ending_soon`):
  - Render existing title and `endingSoonBody(n, viewerZone)`.

- [ ] **Step 5: Update `useBookingMutations.ts`, `CreateBookingModal.tsx`, and `RoomSchedulePage.tsx`**

In `useBookingMutations.ts`:
Remove `skipped` from `BookingSeriesResult`.
In `useCreateBookingSeries`, add `onSettled` callback:
```ts
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
}
```

In `RoomSchedulePage.tsx`:
Remove `seriesPartialMessage` state and banner element since partial series creation is completely removed.

- [ ] **Step 6: Run frontend tests to verify pass**

Run: `npx vitest run` in `apps/web`.
Expected: PASS

- [ ] **Step 7: Run full test suite across monorepo**

Run: `npm test` at repo root.
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): update error mapping, notification bell, and modal for atomic series conflicts"
```
