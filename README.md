# Бронювання переговорних — skeleton

Cold-start skeleton for a meeting-room booking app: npm workspaces monorepo,
one Docker image, Postgres alongside it. **No product features yet** — no
auth, no bookings. This exists only to prove the whole path (build, migrate,
seed, serve) works cleanly from a fresh clone before anything is built on top
of it.

## Stack

| Layer | Tech |
|---|---|
| `apps/api` | NestJS 11 (Express adapter), all routes under `/api` |
| `apps/web` | Vite 8 + React 19.2 + Tailwind 4 (CSS-first, no config file) |
| `packages/core` | Shared Zod schemas and pure domain logic |
| DB | PostgreSQL 18 + Drizzle ORM (pinned exactly: `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`) |

In production, the Nest server serves the built SPA from the same origin —
no CORS, no second container. See `CLAUDE.md` for the full architecture
writeup, pinned-version rationale, and hard rules (never `drizzle-kit push`;
all timestamps UTC).

## Run with Docker (recommended)

```bash
cp .env.example .env
docker compose up --build
```

- App: http://localhost:3000
- Health check: http://localhost:3000/api/health

Migrations and the room seed run automatically at container start. Safe to
run `docker compose down && docker compose up` repeatedly — the seed is
idempotent.

## Local development (without Docker)

Requires Node 24 and a running Postgres 18.

```bash
cp .env.example .env   # adjust POSTGRES_* to point at your local Postgres
npm install
npm run build           # builds packages/core, apps/web, apps/api in order
npm run dev:api          # starts the API (runs migrate + seed on boot)
npm run dev:web           # separate terminal: Vite dev server for the SPA
```

## Tests

```bash
npm test
```

Runs unit tests for all three workspaces (Vitest for `packages/core` and
`apps/web`, Jest for `apps/api`, plus a real `tsc` typecheck since ts-jest's
`isolatedModules` mode does not type-check). apps/api also has an e2e suite
(`npm run test:e2e -w apps/api`) covering the health endpoint, the JSON
404 on unknown `/api/*` routes, and the SPA fallback for deep links.

## Generating a new migration

```bash
npm run db:generate
```

Never run `drizzle-kit push` — see `CLAUDE.md` for why.

## Seed data

Six rooms, inserted idempotently (`onConflictDoNothing` on the unique
`name` column):

| Room | Floor | Capacity |
|---|---|---|
| Дуб | 1 | 4 |
| Ясен | 1 | 6 |
| Липа | 2 | 8 |
| Верба | 2 | 4 |
| Сосна | 3 | 10 |
| Клен | 3 | 2 |

## Environment variables

Every variable here is read by the code (`apps/api/src/config/env.ts`,
`apps/api/drizzle.config.ts`) — nothing declared and unused, nothing read
that isn't listed:

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | Standard Node environment flag |
| `PORT` | `3000` | Port the Nest server listens on |
| `COOKIE_SECURE` | `false` | Adds the `Secure` flag to the session cookie. Set to `true` when serving over HTTPS; leaving it `false` is what lets the plain-http compose run log in |
| `POSTGRES_HOST` | `localhost` | Postgres host (docker-compose overrides this to `db` for the api container) |
| `POSTGRES_PORT` | `5432` | Postgres port |
| `POSTGRES_USER` | `booking` | Postgres user |
| `POSTGRES_PASSWORD` | `booking` | Postgres password |
| `POSTGRES_DB` | `booking` | Postgres database name |

## Authentication

Registration, login, logout and session restore are in place. Passwords are
hashed with bcrypt at cost 12. A session is an opaque 32-byte random token —
not a JWT — stored in the `sessions` table and handed to the browser in an
httpOnly, SameSite=Lax cookie that lives for 30 days, so a reload keeps you
signed in. Emails are lowercased and trimmed before they are stored, so
`IVAN@x.com` and ` ivan@x.com ` are the same account.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create an account and start a session |
| `POST` | `/api/auth/login` | Start a session |
| `POST` | `/api/auth/logout` | End the session (idempotent) |
| `GET` | `/api/auth/me` | Current user, or `401` |

## Bookings and the overlap guarantee

Two people must never end up with the same room at the same time — and the
thing that guarantees it is a database constraint, not a check in the Nest
service layer:

```sql
create extension if not exists btree_gist;

alter table bookings add constraint bookings_no_overlap
  exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (canceled_at is null);
```

A `SELECT` to check for a clash, followed by an `INSERT` if none is found,
always leaves a race between the two statements. A GiST exclusion constraint
closes it: Postgres rejects the conflicting `INSERT` atomically, at the
storage layer, regardless of how many requests reach the table at once.

- **`'[)'` — half-open range.** A booking ending at 10:00 and one starting at
  10:00 do not overlap under this constraint. Back-to-back bookings are a
  normal, desired case for a shared room and must not be rejected — a closed
  range (`'[]'`) would incorrectly treat them as clashing on the shared
  instant.
- **`where (canceled_at is null)` — partial constraint.** Cancelling is a
  soft delete (`canceled_at` set, row kept for history). Without this
  predicate, a cancelled booking would keep holding its slot forever, since
  the exclusion constraint has no other way to know a row is no longer
  "live".
- **The application never locks anything.** `BookingsService.create` issues
  one `INSERT`; if two identical requests arrive at the same instant,
  Postgres itself picks one winner and reports the loser's `INSERT` as a
  constraint violation (SQLSTATE `23P01`), which the repository translates
  to an HTTP `409` (see `CLAUDE.md` for the `DrizzleQueryError`/`runQuery`
  unwrapping this relies on). No mutex, no `SELECT ... FOR UPDATE`.

Reproduce it with:

```bash
npm run prove:race
```

`scripts/prove-no-overlap.mjs` registers a user, finds a free 1-hour slot
inside office hours, and fires two byte-for-byte identical
`POST /api/bookings` requests with `Promise.all` so they are genuinely
in flight together. It then asserts exactly one `201`, exactly one `409`,
and exactly one matching row in `GET /api/rooms/:id/bookings` — the DB, not
the count of successful requests, is the source of truth.

## Cancelling someone else's booking

`DELETE /api/bookings/:id` returns `403` when the booking belongs to another
user — checked server-side in `BookingsService.cancel` against the
authenticated session, not by the frontend merely hiding the cancel button
for rows you don't own. A client that never renders that button for someone
else's booking would still be refused here.

```bash
npm run prove:403
```

`scripts/prove-forbidden-cancel.sh` registers two users in separate cookie
jars, has the first create a booking, then has the second — authenticated as
themselves — attempt to cancel it. The script prints the full raw response
(`curl -i`) so the `403` and its Ukrainian message are visible directly, then
re-reads the room's bookings to confirm nothing was actually cancelled.
Finally the first user cancels their own booking successfully (`204`),
showing the `403` above was about authorization, not a broken endpoint.

## What's explicitly out of scope here

No room-schedule UI yet, and no recurring bookings — the week grid, the create
and cancel screens and the `booking_series` grouping all arrive in later
phases, so `DELETE /api/bookings/:id` deliberately takes no `?scope=series`
yet. Beyond authentication and bookings, the groundwork this repo covers is: the monorepo
builds, the Docker image runs non-root with no dev dependencies, migrations +
seed are idempotent, and routing correctly splits between the API (JSON,
including 404s) and the SPA (HTML fallback for deep links).
