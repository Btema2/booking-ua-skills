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
| `POSTGRES_HOST` | `localhost` | Postgres host (docker-compose overrides this to `db` for the api container) |
| `POSTGRES_PORT` | `5432` | Postgres port |
| `POSTGRES_USER` | `booking` | Postgres user |
| `POSTGRES_PASSWORD` | `booking` | Postgres password |
| `POSTGRES_DB` | `booking` | Postgres database name |

## What's explicitly out of scope here

No authentication, no bookings table, no room-schedule UI. This skeleton's
job is limited to: the monorepo builds, the Docker image runs non-root with
no dev dependencies, migrations + seed are idempotent, and routing correctly
splits between the API (JSON, including 404s) and the SPA (HTML fallback for
deep links).
