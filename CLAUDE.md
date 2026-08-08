# CLAUDE.md

Start as **skeleton** (npm workspaces monorepo, one Docker image, Postgres alongside). Prove cold path — clone → build → migrate → seed → serve — unbreakable before real features land. Phase done. Build now proceed through `docs/SPEC.md`'s Phase 1–9 (auth, rooms UI, bookings, week grid, mobile, bonuses).

Repo root (`booking-ua-skills-task/`) = working dir every session — start agents here, not one level up.

## reference/ — gitignored working material

`reference/` = read-only input for agent: never commit, never write. Hold:

- `reference/task-spec.md` — tournament task brief.
- `reference/design-handoff/` — design handoff bundle
  (`Room Booking.dc.html` + `_ds/`, `assets/`, etc). **1:1
  source of truth for all UI work** — match it, don't improvise.
  After Phase 2, work from extracted `apps/web/src/styles/tokens.css`
  and `docs/DESIGN-NOTES.md` instead — reopen handoff only if something
  missing from both.

## docs/SPEC.md — authoritative build spec

`docs/SPEC.md` decide **how** Phase 1–9 built. `reference/task-spec.md`
(tournament brief) decide **what** must exist — where two disagree,
brief win on *what*, SPEC.md win on *how*. SPEC.md enforce rule on
itself: read only phase currently worked, don't read ahead. Carry
rule into every session here too.

## Phase workflow

Loop per `docs/SPEC.md` §7 phase: **new session → code phase → verify → fix
if broken → next phase.**

- **New session** — check `git log` for last phase commit, read
  that phase's section in SPEC.md §7 only.
- **Code phase** — dynamic multi-agent execution for phase's independent
  tasks, not solo sequential work.
- **Verify** — run that phase's literal *Accept* checks from SPEC.md §7,
  plus standing rule below (`npm test`, clean `docker compose up
  --build`). Show command output — never assert success unexecuted.
- **Fix if broken** — debug loop back into code phase, touch only
  broken piece.
- **Next phase** — conventional commit, move to next phase.

## Critical constraints (Phase 1–9)

Full detail in `docs/SPEC.md`; these easiest to violate by habit:

- Overlap: DB `EXCLUDE` constraint, `'[)'` half-open range (never `'[]'`),
  catch SQLSTATE `23P01` (never message text) → HTTP 409. **`err.code` on
  thrown error is `undefined`** — drizzle wrap driver error in
  `DrizzleQueryError`, SQLSTATE sit one level down on `cause`. Use
  `runQuery()` from `src/db/driver-errors.ts`, match `QueryFailedError.code`.
  Phase 1 hit exact bug: naive check made duplicate email 500, not 409.
- **Never let `DrizzleQueryError` escape repository.** Its `message` and
  `params` carry bound query values — on `users` insert that mean bcrypt
  hash straight to stdout. `runQuery()` redact it. Wrap every query.
- No calendar library (FullCalendar etc) — disqualifying per brief.
- Luxon 3 for timezone math, never `Temporal` (unsupported on Safari/iOS).
- Week grid columns = office days (Kyiv calendar); row labels render in
  viewer's zone — never one fixed offset applied to whole week.
- Mobile single-day pager vs desktop grid breakpoint: CSS uses `max-width: 760px`;
  JS switcher (`useIsMobile`) switches grid to single-day pager at `vw < 761` (desktop is `>= 761px`).
- Room Schedule URL Search Params: `?week=YYYY-MM-DD` specifies the week range; `?day=YYYY-MM-DD` (Kyiv date) specifies the active day for the mobile pager. Navigating from list/my-bookings must pass both `week` and `day` so mobile lands on the exact day of a meeting while desktop continues to render the full week grid.
- Own-vs-other booking distinguished by shape/text too, never colour alone;
  7:1 contrast floor inside grid.

## Monorepo layout

- `apps/api` — NestJS 11 (Express adapter). All routes under `/api`, each in
  own feature module (`AuthModule`, later rooms/bookings/notifications).
  In production same process also serves built SPA — as **middleware**
  (`src/static/spa-fallback.middleware.ts`, wired in `AppModule.configure`),
  never controller. Middleware hold no route, so cannot shadow feature module
  whatever import order; `/api` handed to `next()` → Nest's own not-found
  handler answer JSON 404.
- `apps/web` — Vite + React SPA. Builds to static assets only; ships no
  runtime Node dependencies.
- `packages/core` — Shared Zod schemas (auth, rooms, bookings, recurring
  series), office-hours/DST math and week-grid slot generation on Luxon.
  Consumed by both apps
  via `@booking/core`. `apps/api` import built CJS (`dist/`); `apps/web`
  alias to TS **source** (`vite.config.ts` + `tsconfig.json` `paths`) — skip
  CJS interop, kill core-must-build-first ordering in dev. Same schema feed
  server validation and `zodResolver` on client, so rule live one place.
- `apps/web/vite.config.ts` is single config for dev, build **and** vitest
  (`defineConfig` from `vitest/config`). No separate `vitest.config.ts`.
  Dev server proxy `/api` → `localhost:3000`.

## Pinned versions and why

- **Node 24** (`node:24-slim` in Dockerfile) — current LTS.
- **TypeScript 5.9.3** — pinned below 7. TypeScript 7 exists on npm as of
  this writing (native Go-based rewrite) but `ts-jest`'s installed
  version requires `typescript: >=4.3 <7`; 5.9.3 also what `@nestjs/cli`
  itself depends on, so natural common denominator.
- **drizzle-orm@0.45.2 / drizzle-kit@0.31.10, exact, no `^`** — v1 release
  candidate exists on npm; don't upgrade to it without deliberately
  re-verifying migration workflow below.
- **bcrypt@6.0.0** — native, but ships prebuilds via `node-gyp-build`, so
  `npm ci` in `node:24-slim` need no compiler. Cost factor 12 per SPEC.
- **cookie-parser@1.4.7** — session cookie opaque token, no JWT.
- **react-router@8.3.0** — declarative mode (`BrowserRouter`/`Routes`/`Route`),
  no framework mode, no `react-router-dom` package. Peer need react >=19.2.7;
  repo has 19.2.8.
- **@tanstack/react-query@5.101.4** — server state only (`['auth','me']`).
  Never mirror server state into client store.
- **react-hook-form@7.84.0 + @hookform/resolvers@5.7.1** — `zodResolver` feed
  from `@booking/core`, so validation rule live one place, shared with API.
- **luxon@3.7.2 / @types/luxon@3.7.3, exact, in `packages/core`** — the
  timezone-math library for office-hours/DST logic. Not `Temporal`: Safari
  still doesn't ship it, so it's absent on every iOS browser.

## Commands

```bash
npm install                    # once, at the repo root
npm run build                  # core -> web -> api, then copies web dist into api dist/public
npm run dev:api                # apps/api in watch mode (runs migrate+seed on boot)
npm run dev:web                # apps/web Vite dev server, separate terminal
npm test                       # all three workspaces: vitest (core, web) + tsc + jest (api)
npm run db:generate            # drizzle-kit generate, from repo root or apps/api
docker compose up --build      # full stack: postgres:18 + the api image
```

## HARD RULE: never run `drizzle-kit push`

Generate SQL migrations with `drizzle-kit generate` (committed to
`apps/api/drizzle/`), apply with **programmatic** `migrate()`
from `drizzle-orm/node-postgres/migrator`, wired into `apps/api/src/main.ts`
at process start, before HTTP server starts listening. `push` introspects
live database, can silently drop objects it can't model against
Drizzle schema DSL — schema already has one such object
(`CREATE EXTENSION IF NOT EXISTS btree_gist`, hand-added to first
migration), will eventually carry hand-written `EXCLUDE` constraint for
booking overlap checks. `push` not shortcut here; actively unsafe.

## HARD RULE: all timestamps UTC; never hardcode Kyiv's offset

Store every timestamp in UTC. Office is `Europe/Kyiv`, but Kyiv UTC+2
in winter and UTC+3 in summer (EU DST rules), *viewer's* zone may
switch DST different date than Kyiv does. Never write `+2` or `+3`
literally anywhere. Always compute offset from specific instant in
question (e.g. via `Intl.DateTimeFormat` with `timeZone: 'Europe/Kyiv'`, or
equivalent tz-aware library call) — never from "today" or cached value.
Applies to every `timestamptz` column now in the schema: `bookings.starts_at`/
`ends_at`, `users.email_verified_at`, and every `created_at`/`canceled_at`.

## Language split

UI strings Ukrainian (see `apps/web/src/App.tsx`, seed room names).
Everything else — code, identifiers, comments, commit messages — English.

## Git discipline

Small, meaningful commits. Conventional Commits format
(`feat:`, `fix:`, `chore:`, `docs:`, ...).

## Code hygiene

- No dead code, no unused exports.
- Every env var read in code must appear in `.env.example`, and vice versa
  — `apps/api/src/config/env.ts` (zod-validated) and
  `apps/api/drizzle.config.ts` only two places `process.env` read
  directly; check both before adding or removing variable.
- New API surface go in own feature module (`controllers` + `providers`
  inside module, module listed in `AppModule.imports`) — never root
  `controllers` array. SPA fallback is middleware, so no ordering trap
  anymore; `app.module.spec.ts` prove it by importing feature module
  *after* `AppModule` and asserting its `/api` route still win.
  Wildcard route syntax under Express 5 is `{*splat}`, not `*`.

## Standing verification rule

`docker compose up --build` from **clean clone** must succeed with no
manual steps, no crash loop, green Postgres healthcheck before app
starts, six seeded rooms, idempotent behavior across
`docker compose down && docker compose up` — checked before any commit
considered done. `npm test` must also pass at repo root.

## graphify

Project has knowledge graph at graphify-out/ with god nodes, community structure, cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships, `graphify explain "<concept>"` for focused concepts. Return scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain don't surface enough context.
- After modifying code, run `graphify update .` to keep graph current (AST-only, no API cost).

## Context7 MCP

Before writing/changing code touching library, framework, SDK, or
CLI tool (NestJS, Drizzle, Zod, Vite, React, Docker Compose, etc), use
Context7 MCP to fetch current documentation first — API syntax, config
options, version-specific behavior — rather than relying on training data,
which may be stale/wrong for pinned versions in this repo. Resolve
library ID, then query docs with specific question before
implementing.