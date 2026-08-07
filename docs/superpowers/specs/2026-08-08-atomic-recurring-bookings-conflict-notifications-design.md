# Atomic Recurring Bookings & Conflict Notifications — Design

## Overview

This specification replaces the partial series creation behavior (where overlapping occurrences were skipped while non-overlapping occurrences were created) with strict **atomic recurring booking creation**. When a user attempts to create a recurring booking series:
1. If **ANY** occurrence overlaps with an existing active booking in the room, **no bookings are created** (0 created).
2. The endpoint returns `409 Conflict` with a clear, user-facing Ukrainian error message detailing the conflict.
3. A system notification (`kind: 'series_conflict'`) is saved to the database for the user and displayed in the notification bell menu and in the booking modal prompt.

---

## 1. Domain & API Layer Specifications

### API Endpoint: `POST /api/bookings/series`

- **Request Body**: `CreateBookingSeriesSchema`
  - `roomId`: `number`
  - `title`: `string`
  - `startsAt`: `ISO string`
  - `endsAt`: `ISO string`
  - `occurrenceCount`: `number` (2–52)

- **Success Response (`201 Created`)**:
  ```json
  {
    "series": { "id": "uuid" },
    "created": [ /* Array of N Booking objects */ ]
  }
  ```
  *(The `skipped` array is removed as partial creation is no longer supported).*

- **Conflict Response (`409 Conflict`)**:
  When **1 overlap** occurs:
  ```json
  {
    "statusCode": 409,
    "message": "Не вдалося створити повторювані зустрічі: конфліктує з зустріччю «Планування» (18.08.2026 10:00–11:00). Будь ласка виберіть інший час",
    "conflictsCount": 1
  }
  ```
  When **> 1 overlaps** occur (e.g. 3 overlaps):
  ```json
  {
    "statusCode": 409,
    "message": "Не вдалося створити повторювані зустрічі: конфліктує з 3 зустрічами",
    "conflictsCount": 3
  }
  ```

- **Validation Error (`400 Bad Request`)**:
  If any occurrence fails time alignment, minimum/maximum duration, or office hours validation, returns `400 Bad Request` prior to database queries.

---

## 2. Database Schema & Migration

### Migration `0010_series_conflict_notifications.sql`

Modify `notifications` table to support non-booking-specific notifications (such as recurring series conflict alerts):

```sql
ALTER TABLE notifications ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE notifications ADD COLUMN message text NULL;
```

Updated Drizzle Schema (`apps/api/src/db/schema.ts`):
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

---

## 3. Service & Repository Implementation (`apps/api`)

### Overlap Detection & Transactional Execution

In `BookingsService.createSeries`:
1. Generate `occurrences = weeklyOccurrences(startsAt, endsAt, count)`.
2. Validate each occurrence with `validateBookingTimes(occurrence, now)`. Throw `400 Bad Request` if invalid.
3. Within a database transaction:
   - Execute `findOverlappingBookings(roomId, occurrences)` to fetch active (non-cancelled) bookings in `roomId` whose `[startsAt, endsAt)` overlaps with any occurrence.
   - If `overlappingBookings.length > 0`:
     - If `length === 1`:
       - Format conflict details: `«${booking.title}» (${formattedDate} ${formattedTimeRange})` using Europe/Kyiv zone.
       - Construct message: `"Не вдалося створити повторювані зустрічі: конфліктує з зустріччю " + details + ". Будь ласка виберіть інший час"`
     - If `length > 1`:
       - Construct message: `"Не вдалося створити повторювані зустрічі: конфліктує з " + count + " зустрічами"`
     - Insert row into `notifications`: `{ userId, kind: 'series_conflict', message }`.
     - Transaction rolls back / aborts insertion of `booking_series` and `bookings`.
     - Throw `ConflictException` (409) with constructed message.
   - If `overlappingBookings.length === 0`:
     - Insert `booking_series` row.
     - Insert all N occurrences into `bookings` tagged with `seriesId`.
     - Commit transaction and return `{ series: { id }, created }`.

### Notifications Repository (`DrizzleNotificationsRepository`)

Update `listForUser`:
- Change `innerJoin(bookings, ...)` and `innerJoin(rooms, ...)` to `leftJoin`, ensuring notifications with `bookingId = null` (e.g. `series_conflict`) are retrieved.

---

## 4. Frontend & Notification Bell (`apps/web`)

1. **`NotificationBell.tsx`**:
   - Renders `series_conflict` notifications:
     - Title: `"Не вдалося створити повторювані зустрічі"`
     - Body: `n.message`
     - Uses alert/warning style icon.

2. **`CreateBookingModal.tsx`**:
   - On submitting recurring booking, handles `409 Conflict` error from API.
   - Renders server error message in the modal alert container (`serverFormError`).
   - Invokes `queryClient.invalidateQueries({ queryKey: ['notifications', 'mine'] })` so notification bell updates immediately.

3. **`RoomSchedulePage.tsx`**:
   - Clean up partial creation code/state (`seriesPartialMessage`).

---

## 5. Verification Plan

1. **Unit & Domain Tests**:
   - Test Ukrainian message formatting for 1 conflict vs N conflicts.
   - Test `BookingsService.createSeries` logic for 0 overlaps (succeeds), 1 overlap (409 + notification created), N overlaps (409 + notification created).
2. **Integration Tests (`apps/api/test/bookings.int-spec.ts`)**:
   - Test POST `/api/bookings/series` conflict handling against real DB.
   - Verify notification list returns `series_conflict` notification.
3. **Frontend Integration Tests (`apps/web`)**:
   - Verify modal error display on 409 response.
   - Verify `NotificationBell` renders `series_conflict` item.
4. **Clean Build Verification**:
   - Run `npm test` at repo root.
