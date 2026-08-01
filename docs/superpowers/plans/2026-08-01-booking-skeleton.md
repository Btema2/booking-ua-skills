# Meeting-Room Booking Skeleton — Implementation Plan

> **For agentic workers:** Execute inline in this session (author already holds full
> context from spec discussion; no subagent handoff). Steps use checkbox (`- [ ]`)
> syntax for tracking.

**Goal:** A cold-clone-to-`docker compose up` skeleton monorepo (NestJS API + Vite/React
SPA + shared Zod package + Postgres/Drizzle) with a rooms table, one migration, an
idempotent seed, and a proven SPA-fallback/JSON-404 routing split. No auth, no bookings.

**Architecture:** npm workspaces (`apps/api`, `apps/web`, `packages/core`). Nest (Express
adapter) serves the built Vite SPA from the same origin in production — single Docker
image, single container, Postgres as a second compose service. Drizzle migrations are
pre-generated SQL files committed to the repo; `apps/api` applies them with the
programmatic `migrate()` at process start, before the HTTP server begins listening.

**Tech Stack (exact versions — resolved against the npm registry on 2026-08-01):**

| Package | Version | Note |
|---|---|---|
| node | 24 (node:24-slim) | LTS, required |
| typescript | 5.9.3 | pinned <7 — ts-jest 29/30 requires `typescript: >=4.3 <7`; 5.9.3 is also what `@nestjs/cli@11` itself depends on |
| @nestjs/core, common, platform-express, testing | 11.1.28 | |
| @nestjs/cli | 11.0.24 | devDependency, scaffolds nothing we don't already hand-write |
| express | 5.2.1 | Nest 11 Express adapter target |
| reflect-metadata | 0.2.2 | |
| rxjs | 7.8.2 | |
| drizzle-orm | 0.45.2 EXACT | pinned per hard requirement, no `^` |
| drizzle-kit | 0.31.10 EXACT | pinned per hard requirement, no `^`; used for `generate` only, never `push` |
| pg | 8.22.0 | node-postgres driver |
| zod | 4.4.3 | shared schemas in packages/core |
| vite | 8.2.0 | |
| @vitejs/plugin-react | 6.0.5 | |
| react, react-dom | 19.2.8 | |
| tailwindcss, @tailwindcss/vite | 4.3.3 | CSS-first — no `tailwind.config.js` |
| vitest | 4.1.10 | packages/core + apps/web unit tests |
| jest, ts-jest, @types/jest | 30.4.2 / 29.4.12 / 30.0.0 | apps/api unit + e2e tests (Nest default) |
| supertest, @types/supertest | 7.2.2 / 7.2.1 | apps/api e2e (health, 404 JSON) |
| @types/node | 24.13.3 | matches Node 24 line |

No `dotenv` dependency — Node 24 has native `--env-file`; docker-compose injects env vars
directly into the container.

## Global Constraints

- Never run `drizzle-kit push`. Only `drizzle-kit generate` (SQL files, committed) +
  programmatic `migrate()` from `drizzle-orm/node-postgres/migrator` at process start.
- All timestamps UTC in storage; no timestamp columns exist yet in this skeleton (rooms
  table only), so this is a forward-looking rule recorded in CLAUDE.md, not code yet.
- UI strings Ukrainian; code/identifiers/comments/commits English.
- `.gitignore` excludes `node_modules`, `dist`, `.env`, `design/`.
- `.env.example` committed, matches every env var actually read in code — no orphans in
  either direction.
- Runtime Docker image: no devDependencies, non-root user.
- Unknown `/api/*` → JSON 404. Any other unmatched path → `index.html` (SPA fallback).
- Commit in small conventional-commit steps as the plan progresses, with
  `Co-Authored-By: Claude` trailers. Never squash.

---

## File Structure

```
booking-ua-skills-task/
├── package.json                 # root workspaces manifest + npm test/build/dev scripts
├── package-lock.json
├── tsconfig.base.json            # shared compiler options, extended by each workspace
├── .gitignore
├── .dockerignore
├── .env.example
├── Dockerfile                    # multi-stage: deps → build → prod-deps → runtime
├── docker-compose.yml            # api service + postgres:18 service
├── README.md
├── CLAUDE.md                     # written last, once everything passes
├── packages/core/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── schemas/room.ts       # RoomSchema (zod), Room type
│   │   ├── office.ts             # OFFICE_TIMEZONE, OFFICE_OPEN_HOUR, OFFICE_CLOSE_HOUR
│   │   └── index.ts              # public exports
│   └── src/schemas/room.test.ts  # vitest
├── apps/api/
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── drizzle.config.ts         # generate-only config, dialect postgresql
│   ├── drizzle/                  # committed SQL migrations + meta (generated, not hand-written)
│   └── src/
│       ├── main.ts               # bootstrap: migrate() → seed() → Nest app → SPA/404 wiring → listen
│       ├── app.module.ts
│       ├── config/env.ts         # zod-validated process.env reader, single source of truth
│       ├── health/health.controller.ts (+ .spec.ts)
│       └── db/
│           ├── schema.ts         # drizzle rooms table
│           ├── connection.ts     # pg Pool + drizzle() instance
│           ├── migrate.ts        # programmatic migrate() runner
│           └── seed.ts           # idempotent 6-room seed (onConflictDoNothing)
│       └── static/spa.middleware.ts (+ .spec.ts)  # static assets + SPA fallback + JSON 404
│   └── test/health.e2e-spec.ts   # supertest: /api/health, /api/does-not-exist
└── apps/web/
    ├── package.json
    ├── vite.config.ts             # @tailwindcss/vite + @vitejs/plugin-react
    ├── index.html                 # real title, real favicon — no Vite defaults
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx                # placeholder Ukrainian-language shell, proves SPA served
    │   └── styles.css             # @import "tailwindcss";
    └── public/favicon.svg
```

**Interfaces (cross-task contracts):**
- `packages/core` exports `RoomSchema: z.ZodObject`, `type Room`, `OFFICE_TIMEZONE = 'Europe/Kyiv'`.
- `apps/api/src/db/schema.ts` exports `rooms` (drizzle pgTable) with columns
  `id (serial pk)`, `name (text, unique, not null)`, `floor (integer, not null)`,
  `capacity (integer, not null)`.
- `apps/api/src/db/connection.ts` exports `pool: Pool` and `db: NodePgDatabase`.
- `apps/api/src/db/migrate.ts` exports `async function runMigrations(): Promise<void>`.
- `apps/api/src/db/seed.ts` exports `async function seedRooms(): Promise<void>`.
- `apps/api/src/config/env.ts` exports `env: { NODE_ENV, PORT, POSTGRES_HOST,
  POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB }` (parsed once, zod-validated,
  process exits with a clear message on failure).
- `apps/api/src/static/spa.middleware.ts` exports
  `function mountSpaAndApiNotFound(app: NestExpressApplication, publicDir: string): void`.

---

## Task 1: Root workspace + shared TS config

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `.dockerignore`, `.env.example`, `README.md` (stub, filled in later task)

- [ ] Init git repo, root `package.json` with `"workspaces": ["apps/*", "packages/*"]`,
      pinned `devDependencies` (typescript@5.9.3), scripts:
      `dev`, `build`, `test` (runs `npm test --workspaces --if-present`),
      `db:generate` (delegates to apps/api).
- [ ] `tsconfig.base.json`: `target: ES2023`, `module: NodeNext`, `moduleResolution: NodeNext`,
      `strict: true`, `skipLibCheck: true`, `esModuleInterop: true`,
      `experimentalDecorators: true`, `emitDecoratorMetadata: true` (needed by Nest DI
      even though this skeleton has no injectable services yet beyond controllers).
- [ ] `.gitignore`: `node_modules/`, `dist/`, `.env`, `design/`, plus standard OS/editor junk.
- [ ] `.env.example` — placeholder only; finalized once `config/env.ts` exists (Task 4)
      so every var listed there is actually read.
- [ ] Commit: `chore: init npm workspaces monorepo skeleton`

## Task 2: packages/core — Zod schema + pure domain constants

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`,
  `packages/core/src/schemas/room.ts`, `packages/core/src/schemas/room.test.ts`,
  `packages/core/src/office.ts`, `packages/core/src/index.ts`

- [ ] Write failing test `room.test.ts`: valid room parses; empty name, negative floor,
      zero/negative capacity all throw.
- [ ] Run `npx vitest run` in packages/core → fails (module doesn't exist).
- [ ] Implement `room.ts`:
  ```ts
  import { z } from 'zod';

  export const RoomSchema = z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    floor: z.number().int(),
    capacity: z.number().int().positive(),
  });

  export type Room = z.infer<typeof RoomSchema>;
  ```
- [ ] Implement `office.ts`:
  ```ts
  export const OFFICE_TIMEZONE = 'Europe/Kyiv';
  export const OFFICE_OPEN_HOUR = 9;
  export const OFFICE_CLOSE_HOUR = 19;
  ```
- [ ] `index.ts` re-exports both.
- [ ] Run tests → pass.
- [ ] Commit: `feat(core): add Room zod schema and office constants`

## Task 3: apps/api — Nest bootstrap + health endpoint

**Files:**
- Create: `apps/api/package.json`, `tsconfig.json`, `nest-cli.json`,
  `src/main.ts`, `src/app.module.ts`, `src/health/health.controller.ts`,
  `src/health/health.controller.spec.ts`, `test/health.e2e-spec.ts`, `jest.config.ts` (or jest key in package.json)

- [ ] Write failing `health.controller.spec.ts`: controller's `check()` returns
      `{ status: 'ok' }`.
- [ ] Implement `HealthController`:
  ```ts
  import { Controller, Get } from '@nestjs/common';

  @Controller('health')
  export class HealthController {
    check() {
      return { status: 'ok' as const };
    }
  }
  ```
  (add `@Get()` decorator on `check`)
- [ ] `AppModule` registers `HealthController`.
- [ ] `main.ts` bootstraps with `app.setGlobalPrefix('api')`, `app.listen(env.PORT)` —
      DB wiring added in Task 5, static/SPA wiring in Task 6.
- [ ] Run unit test → pass.
- [ ] Write failing e2e `test/health.e2e-spec.ts` (supertest): `GET /api/health` → 200
      `{status:'ok'}`.
- [ ] Run e2e → pass once main bootstrap correct.
- [ ] Commit: `feat(api): nest bootstrap with health endpoint`

## Task 4: apps/api — validated env config

**Files:**
- Create: `apps/api/src/config/env.ts`, `apps/api/src/config/env.spec.ts`
- Modify: `.env.example` (root)

- [ ] Write failing test: missing `POSTGRES_PASSWORD` → `loadEnv()` throws with a message
      naming the missing key.
- [ ] Implement:
  ```ts
  import { z } from 'zod';

  const EnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    POSTGRES_HOST: z.string().min(1),
    POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
    POSTGRES_USER: z.string().min(1),
    POSTGRES_PASSWORD: z.string().min(1),
    POSTGRES_DB: z.string().min(1),
  });

  export type Env = z.infer<typeof EnvSchema>;

  export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
    const result = EnvSchema.safeParse(source);
    if (!result.success) {
      throw new Error(`Invalid environment configuration: ${result.error.message}`);
    }
    return result.data;
  }

  export const env = loadEnv();
  ```
- [ ] Run test → pass.
- [ ] Update root `.env.example` with every key above (dev-friendly defaults for
      POSTGRES_HOST=localhost, POSTGRES_PORT=5432, POSTGRES_USER=booking,
      POSTGRES_PASSWORD=booking, POSTGRES_DB=booking, PORT=3000, NODE_ENV=development).
- [ ] Commit: `feat(api): zod-validated environment config`

## Task 5: apps/api — Drizzle schema, connection, migration, seed

**Files:**
- Create: `apps/api/src/db/schema.ts`, `src/db/connection.ts`, `src/db/migrate.ts`,
  `src/db/seed.ts`, `drizzle.config.ts`
- Generated (not hand-written): `apps/api/drizzle/0000_*.sql`, `apps/api/drizzle/meta/*`

- [ ] Implement `schema.ts`:
  ```ts
  import { pgTable, serial, text, integer } from 'drizzle-orm/pg-core';

  export const rooms = pgTable('rooms', {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    floor: integer('floor').notNull(),
    capacity: integer('capacity').notNull(),
  });
  ```
- [ ] Implement `connection.ts`:
  ```ts
  import { Pool } from 'pg';
  import { drizzle } from 'drizzle-orm/node-postgres';
  import { env } from '../config/env';
  import * as schema from './schema';

  export const pool = new Pool({
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB,
  });

  export const db = drizzle(pool, { schema });
  ```
- [ ] `drizzle.config.ts` (root of apps/api, used by CLI only, never at runtime):
  ```ts
  import type { Config } from 'drizzle-kit';

  export default {
    dialect: 'postgresql',
    schema: './src/db/schema.ts',
    out: './drizzle',
    dbCredentials: {
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: process.env.POSTGRES_USER ?? 'booking',
      password: process.env.POSTGRES_PASSWORD ?? 'booking',
      database: process.env.POSTGRES_DB ?? 'booking',
    },
  } satisfies Config;
  ```
- [ ] Add `apps/api/package.json` script `db:generate: drizzle-kit generate`.
- [ ] Run `npm run db:generate -w apps/api` against local Postgres (start one via
      `docker run` throwaway or the eventual compose service) to produce the first
      migration SQL. **Hand-edit the generated SQL** to prepend
      `CREATE EXTENSION IF NOT EXISTS btree_gist;` before the `CREATE TABLE` statement
      (this extension is not representable in the Drizzle schema DSL, which is exactly
      why `push` is banned — it would silently fail to reconcile this).
- [ ] Implement `migrate.ts`:
  ```ts
  import { migrate } from 'drizzle-orm/node-postgres/migrator';
  import { db, pool } from './connection';

  export async function runMigrations(): Promise<void> {
    await migrate(db, { migrationsFolder: './drizzle' });
  }

  if (require.main === module) {
    runMigrations()
      .then(() => pool.end())
      .catch((error) => {
        console.error('Migration failed', error);
        process.exitCode = 1;
      });
  }
  ```
- [ ] Implement `seed.ts` (idempotent via `onConflictDoNothing` on the unique `name`
      column — safe to run every container start):
  ```ts
  import { db } from './connection';
  import { rooms } from './schema';

  const ROOM_SEED = [
    { name: 'Дуб', floor: 1, capacity: 4 },
    { name: 'Ясен', floor: 1, capacity: 6 },
    { name: 'Липа', floor: 2, capacity: 8 },
    { name: 'Верба', floor: 2, capacity: 4 },
    { name: 'Сосна', floor: 3, capacity: 10 },
    { name: 'Клен', floor: 3, capacity: 2 },
  ];

  export async function seedRooms(): Promise<void> {
    await db.insert(rooms).values(ROOM_SEED).onConflictDoNothing({ target: rooms.name });
  }
  ```
- [ ] Wire both into `main.ts` bootstrap, before `NestFactory.create`:
  ```ts
  async function bootstrap() {
    await runMigrations();
    await seedRooms();
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    app.setGlobalPrefix('api');
    await app.init();
    mountSpaAndApiNotFound(app, join(__dirname, 'public'));
    await app.listen(env.PORT);
  }
  ```
- [ ] Manually verify against a local Postgres container: migration creates
      `btree_gist` extension + `rooms` table, seed inserts 6 rows, re-running seed
      inserts 0 additional rows (idempotency check ahead of the full compose check later).
- [ ] Commit: `feat(api): drizzle schema, migration, and idempotent room seed`

## Task 6: apps/api — SPA static serving + JSON 404 for unknown /api/*

**Files:**
- Create: `apps/api/src/static/spa.middleware.ts`, `apps/api/src/static/spa.middleware.spec.ts`

- [ ] Write failing unit test using a real Express app + supertest (no Nest needed for
      this unit): given a `publicDir` fixture with `index.html`, `GET /rooms/1` → 200
      with index.html body; `GET /api/nope` → 404 JSON `{statusCode:404,...}`.
- [ ] Implement:
  ```ts
  import { join } from 'node:path';
  import express, { type Request, type Response, type NextFunction } from 'express';
  import type { NestExpressApplication } from '@nestjs/platform-express';

  export function mountSpaAndApiNotFound(app: NestExpressApplication, publicDir: string): void {
    const instance = app.getHttpAdapter().getInstance();
    instance.use(express.static(publicDir));
    instance.use((req: Request, res: Response, _next: NextFunction) => {
      if (req.path.startsWith('/api')) {
        res.status(404).json({ statusCode: 404, message: 'Not Found', path: req.path });
        return;
      }
      res.sendFile(join(publicDir, 'index.html'));
    });
  }
  ```
- [ ] Update e2e test: `GET /api/does-not-exist` → 404 JSON (not HTML); `GET /rooms/1`
      (once `public/index.html` exists from the web build) → 200 HTML.
- [ ] Run all apps/api tests → pass.
- [ ] Commit: `feat(api): serve SPA with index.html fallback and JSON 404 for unknown api routes`

## Task 7: apps/web — Vite + React 19 + Tailwind 4 shell

**Files:**
- Create: `apps/web/package.json`, `vite.config.ts`, `index.html`, `src/main.tsx`,
  `src/App.tsx`, `src/styles.css`, `public/favicon.svg`

- [ ] `index.html`: real `<title>Бронювання переговорних</title>`, `<link rel="icon"
      href="/favicon.svg">` — no default Vite title/favicon.
- [ ] `vite.config.ts`:
  ```ts
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';
  import tailwindcss from '@tailwindcss/vite';

  export default defineConfig({
    plugins: [react(), tailwindcss()],
    build: { outDir: 'dist' },
  });
  ```
- [ ] `src/styles.css`: `@import "tailwindcss";` only (CSS-first, no config file).
- [ ] `src/App.tsx`: minimal Ukrainian-language placeholder (e.g. "Бронювання
      переговорних — незабаром") proving the SPA renders — no room/booking UI yet,
      out of scope for this skeleton.
- [ ] `src/main.tsx`: standard React 19 `createRoot` bootstrap importing `styles.css`.
- [ ] Run `npm run build -w apps/web` → verify `dist/index.html` + assets exist.
- [ ] Commit: `feat(web): vite react tailwind app shell`

## Task 8: Wire apps/web output into apps/api at build time (local, pre-Docker)

**Files:**
- Modify: `apps/api/package.json` (build script), root `package.json` (build script ordering)

- [ ] Root `build` script builds in dependency order: `core` → `web` → `api`, and after
      `web` build, copies `apps/web/dist/*` into `apps/api/dist/public/` (a small
      `node -e` copy step is enough; no new dependency needed).
- [ ] Run `npm run build` at root → verify `apps/api/dist/public/index.html` exists.
- [ ] Commit: `chore: wire web build output into api dist/public`

## Task 9: Dockerfile + docker-compose

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`, `.dockerignore`

- [ ] Multi-stage `Dockerfile` (exact strategy validated empirically — npm workspaces +
      pruned prod `node_modules` is the known-fragile part; iterate against real
      `docker build` runs, not just written-down intent):
  1. `deps`: `node:24-slim`, copy all `package.json` + lockfile, `npm ci`.
  2. `build`: from `deps`, copy full source, run root `npm run build` (produces
     `packages/core/dist`, `apps/api/dist` incl. `dist/public` from Task 8, and the
     `apps/api/drizzle` SQL files already committed in the source copy).
  3. `prod-deps`: `node:24-slim`, copy all `package.json` + lockfile, `npm ci --omit=dev`.
  4. `runtime`: `node:24-slim`, create non-root user/group, copy `prod-deps`'s
     `node_modules` + relevant `package.json`s, copy `build`'s `apps/api/dist`,
     `packages/core/dist`, `apps/api/drizzle`, set `USER`, `CMD ["node",
     "apps/api/dist/main.js"]`.
- [ ] `docker-compose.yml`: `db` service (`postgres:18`, env from `.env`, named volume,
      healthcheck via `pg_isready`), `api` service (`build: .`, `depends_on: db:
      condition: service_healthy`, `ports: ["3000:3000"]`, `env_file: .env`).
- [ ] `.dockerignore`: `node_modules`, `dist`, `.git`, `docs/`.
- [ ] Commit: `feat: dockerize as single image with postgres compose service`

## Task 10: Full verification pass (Definition of Done)

- [ ] Fresh clone to a temp dir, `docker compose up --build`, confirm no crash loop.
- [ ] Confirm Postgres healthcheck green before api starts (compose logs/ps).
- [ ] `docker exec` into db, `SELECT count(*) FROM rooms;` → 6.
- [ ] `docker compose down && docker compose up` again → api starts clean, room count
      still 6 (no duplicate-key crash).
- [ ] `curl localhost:3000/` → HTML containing the real title.
- [ ] `curl localhost:3000/api/health` → JSON `{status:"ok"}`.
- [ ] `curl localhost:3000/api/does-not-exist` → JSON 404, not HTML.
- [ ] `npm test` at repo root → all workspace tests pass.
- [ ] Inspect runtime image: no `devDependencies` packages present, container user is
      non-root (`docker exec ... whoami`).
- [ ] Fix any root cause found; re-run this entire task until every line passes for real.
- [ ] Commit any fixes with their own conventional-commit messages.

## Task 11: README + housekeeping pass

**Files:**
- Modify: `README.md`
- Verify: `.gitignore`, `.env.example` completeness

- [ ] README: run instructions (docker + local dev), what exists vs. explicitly out of
      scope (no auth/bookings yet), env var table matching `.env.example` exactly.
- [ ] Diff every `process.env.X` read in the codebase against `.env.example` keys —
      zero mismatches either direction.
- [ ] Commit: `docs: add README with run instructions`

## Task 12: CLAUDE.md

- [ ] Only after Task 10 fully passes. Write `CLAUDE.md` at repo root (<150 lines)
      covering: layout, pinned versions + rationale, every command, the two hard rules
      (never `drizzle-kit push`; UTC storage with computed — never hardcoded — Kyiv
      offset), UA-strings/EN-code split, git discipline, code hygiene rules, and the
      standing `docker compose up --build` verification rule.
- [ ] Commit: `docs: add CLAUDE.md`

---

## Self-Review Notes

- Spec coverage: monorepo layout ✓ (Task 1,2,3,7), same-origin serving + SPA
  fallback + JSON 404 ✓ (Task 6), Postgres+Drizzle pinned versions ✓ (Task 5),
  btree_gist via hand-edited migration ✓ (Task 5), idempotent 6-room UA seed ✓
  (Task 5), Node 24/non-root/no-devdeps image ✓ (Task 9,10), gitignore/.env.example/
  README ✓ (Task 1,11), tab title/favicon ✓ (Task 7), incremental conventional
  commits ✓ (every task), CLAUDE.md ✓ (Task 12).
- No product features (auth, bookings, room list UI) included anywhere — matches
  "Nothing else" scope instruction.
