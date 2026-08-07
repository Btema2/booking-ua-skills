# Weekly recurring bookings — design

Phase 8.4 (`docs/SPEC.md` §7 Phase 8 item 4; brief `reference/task-spec.md` §05:
«щовівторка, 8 повторень» with cancellation of one occurrence or the whole
series).

## Scope and risk posture

Additive only. `POST /api/bookings` (single create), its validation path, and
the `bookings_no_overlap` EXCLUDE constraint are not modified by this work —
every new capability is a new function, new endpoint, or a nullable column
with no default that changes existing behavior. This is deliberate: the user
running this build cares more about not breaking Phase 3 (booking core) than
about this feature landing at all.

A series is a thin grouping: `booking_series` holds only `id`, `user_id`,
`created_at`. The recurrence rule itself is not stored. Individual
occurrences are ordinary rows in `bookings`, tagged with `series_id`. This
mirrors the existing SPEC §1 data model note verbatim.

## 1. `packages/core` — pure domain logic (TDD first, no DB, no framework)

### `weeklyOccurrences`

```ts
function weeklyOccurrences(
  firstStart: Date,
  firstEnd: Date,
  count: number,
): { startsAt: Date; endsAt: Date }[]
```

Generates `count` weekly occurrences starting from occurrence 1. **DST
safety is the whole point of this function existing as pure, tested code
rather than inline `+7 days` arithmetic**: 8 weekly occurrences span roughly
two months, which can cross the Kyiv DST boundary (last Sunday of March,
last Sunday of October). Naive UTC `+7×24h` arithmetic silently shifts the
Kyiv wall-clock time of every occurrence after the boundary — a 10:00 Kyiv
booking becomes 09:00 or 11:00 Kyiv, and a slot near the office-hours
boundary (e.g. 18:00–19:00) can flip into rejection territory, which would
misread as a conflict rather than what it actually is.

Implementation: convert `firstStart`/`firstEnd` to `Europe/Kyiv`,
`.plus({ weeks: n })` in that zone (Luxon preserves wall-clock across DST for
week/day-unit arithmetic), convert back to UTC per occurrence.

Required unit test (mirrors the existing overlap-test rigor in SPEC §5):
a series whose first occurrence lands on the last Sunday of March — assert
every occurrence's Kyiv-local `HH:mm` is identical, and that consecutive UTC
instants are **not** uniformly 168 hours apart across the boundary.

### `CreateBookingSeriesSchema`

New, separate Zod schema in `packages/core/src/schemas/booking.ts`:

```ts
{ roomId, title, startsAt, endsAt, occurrenceCount: number (2–52) }
```

Deliberately not a modification of `CreateBookingSchema` — the single-booking
POST path's validated shape must stay byte-identical to what Phase 3/5
already ship.

## 2. Database — new migration, additive only

```sql
create table booking_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  created_at timestamptz not null default now()
);

alter table bookings
  add column series_id uuid null references booking_series(id) on delete set null;
```

Generated with `drizzle-kit generate` (never `push`, per this repo's hard
rule), committed to `apps/api/drizzle/`, applied via the existing
programmatic `migrate()` path. `bookings_no_overlap` is not referenced by
this migration — it keeps working unchanged because nothing about the
EXCLUDE constraint's columns or predicate changes.

## 3. Repository / service layer

- `NewBooking` gains an optional `seriesId?: string`. Every existing caller
  (`BookingsService.create`) omits it, so existing inserts write `NULL` —
  zero behavior change for the single-booking path.
- `BookingsRepository.createSeries(userId, roomId, title, occurrences)`
  reuses the existing per-occurrence insert path (same code that already
  throws `SlotTakenError` on EXCLUDE-constraint conflict) in a loop, one
  occurrence at a time — not one giant transaction, so a conflict on
  occurrence 5 does not roll back occurrences 1–4.
  - **Orphan-row rule**: the `booking_series` row is inserted only after the
    first occurrence insert succeeds. If every occurrence conflicts, the
    series row is never created (or is deleted if already created before the
    loop starts) and the endpoint returns 409 with nothing persisted.
- `BookingsRepository.cancelSeries(userId, seriesId)`: ownership check
  happens **before** the already-cancelled check, mirroring the exact
  ordering in `bookings.service.ts:62-67` — a stranger probing someone
  else's series id always gets 403, never a 409/404 that would leak whether
  the series exists or is already fully cancelled. Stamps `canceled_at` on
  every live occurrence in the series; never deletes the `booking_series`
  row itself (soft delete, same posture as single-booking cancel).
- `BookingsService.create` and `.cancel` are not edited. New methods
  `createSeries` / `cancelSeries` are added alongside them.

### Validation-failure policy (decided)

`validateBookingTimes` failures (alignment, duration, officeHours,
including a *later* occurrence failing office-hours only because DST
shifted its wall-clock time) are treated as **input** errors, not
per-occurrence conflicts: computed and validated for all N occurrences
**before any insert happens**. Any single failure rejects the whole request
with 400 in the existing `{ statusCode, errors }` shape, and nothing is
persisted. Only `slotTaken` (an EXCLUDE-constraint conflict, which can only
be known by attempting the insert) is tolerated per-occurrence and produces
a partial result.

## 4. API

| method | path | notes |
|---|---|---|
| POST | /api/bookings/series | Body: `CreateBookingSeriesSchema`. 201 `{ series, created: Booking[], skipped: [{ startsAt, endsAt }] }`. 400 if any occurrence fails input validation (nothing inserted). 409 if every occurrence conflicts (nothing inserted). |
| DELETE | /api/bookings/:id?scope=series | The SPEC §4-documented, not-yet-implemented series-cancel path. 204. 403 cancelling someone else's series. |

`skipped` entries reuse `BOOKING_REJECTION_MESSAGES.slotTaken` for display
("Слот зайнятий") — no new error vocabulary.

## 5. Frontend

- `CreateBookingModal`: add "Повторювати щотижня" toggle + occurrence-count
  number input (2–52, default empty/unchecked = today's single-booking
  behavior, fully backward compatible). Occurrence 1 is whatever slot the
  user already picked in the week grid — no separate weekday picker needed.
  On submit with the toggle on, calls the new series endpoint instead of the
  single-booking one; renders a summary ("6 з 8 створено") when `skipped`
  is non-empty.
- `CancelBookingDialog`: when the booking being cancelled carries a
  `seriesId`, show a radio choice — "це бронювання" / "уся серія" — before
  the existing confirm button; absent for non-series bookings (no UI change
  for the existing single-cancel flow).

## 6. Verification plan

1. Baseline, before touching anything: `npm test` and
   `npm run test:integration` on clean `main`, record pass counts.
2. TDD per piece (domain function → repository → service → controller →
   frontend), failing-test-first, per `superpowers:test-driven-development`.
3. After the migration lands: `npm test` and `npm run test:integration`
   green with identical or larger counts; `\d bookings` in psql confirms
   `bookings_no_overlap` still present with `'[)'` and
   `where (canceled_at is null)` unchanged; re-run the Phase 3 acceptance
   check live (two parallel identical POSTs to the *single*-booking endpoint
   still produce exactly one row) to prove the EXCLUDE constraint's behavior
   for the original path is untouched.
4. Live proof against the real stack (not just tests): create a series that
   partially conflicts with an existing booking (`skipped` non-empty,
   `created` rows share one `series_id`), cancel one occurrence (its
   `canceled_at` set, `booking_series` row and other occurrences untouched),
   cancel the remaining occurrences via `?scope=series` (their
   `canceled_at` set, `booking_series` row still present, never deleted).
   Show the resulting `bookings`/`booking_series` rows from psql alongside a
   screenshot of the UI reflecting the same state.
5. `npm test` stays green with Docker stopped throughout — no new file
   under test (not `*.int-spec.ts`) may import `getConnection` or otherwise
   require a live database.

## Explicitly out of scope

- Editing an existing series (changing its recurrence rule, adding/removing
  occurrences after creation).
- Any recurrence pattern other than weekly, same weekday, same time.
- A stored RRULE — deliberately thin per the SPEC §1 note.
