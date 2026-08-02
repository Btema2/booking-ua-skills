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
  catch `err.code === '23P01'` (never message text) → HTTP 409.
- No calendar library (FullCalendar etc) — disqualifying per brief.
- Luxon 3 for timezone math, never `Temporal` (unsupported on Safari/iOS).
- Week grid columns = office days (Kyiv calendar); row labels render in
  viewer's zone — never one fixed offset applied to whole week.
- Own-vs-other booking distinguished by shape/text too, never colour alone;
  7:1 contrast floor inside grid.

## Monorepo layout

- `apps/api` — NestJS 11 (Express adapter). All routes under `/api`. In
  production same process also serves built SPA, owns routing
  for everything else (see `src/static/spa.controller.ts`).
- `apps/web` — Vite + React SPA. Builds to static assets only; ships no
  runtime Node dependencies.
- `packages/core` — Shared Zod schemas (`RoomSchema`, `NewRoomSchema`).
  Consumed by `apps/api` via `@booking/core` workspace package —
  `db/seed.ts` validates seed rows through `NewRoomSchema` before insert;
  not yet consumed by `apps/web`.

## Pinned versions and why

- **Node 24** (`node:24-slim` in Dockerfile) — current LTS.
- **TypeScript 5.9.3** — pinned below 7. TypeScript 7 exists on npm as of
  this writing (native Go-based rewrite) but `ts-jest`'s installed
  version requires `typescript: >=4.3 <7`; 5.9.3 also what `@nestjs/cli`
  itself depends on, so natural common denominator.
- **drizzle-orm@0.45.2 / drizzle-kit@0.31.10, exact, no `^`** — v1 release
  candidate exists on npm; don't upgrade to it without deliberately
  re-verifying migration workflow below.
- When later phases add **Luxon 3**, **Tailwind 4**, **React Router**,
  **TanStack Query**, or **react-hook-form** — pin exact + one-line reason
  here, following pattern above.

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
Skeleton has no timestamp columns yet (rooms only); rule
forward-looking for whoever adds bookings.

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
- `apps/api/src/app.module.ts`'s `SpaController` wildcard route (`@All('*')`)
  must stay **last** in `controllers` array — Nest matches controllers
  in array order, anything registered after permanently shadowed.
  `nest generate controller` appends to end of that array, so move
  `SpaController` back to last after generating anything new.
  `app.module.spec.ts` asserts this, fails loudly if regresses.

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