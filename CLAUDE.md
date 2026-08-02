# CLAUDE.md

This is a **skeleton**: npm workspaces monorepo, one Docker image, Postgres
alongside it. No auth, no bookings — only enough to prove the cold path
(clone → build → migrate → seed → serve) is unbreakable before real features
land on top of it.

This repo root (`booking-ua-skills-task/`) is the working directory for
every session — start agents here, not one level up.

## reference/ — gitignored working material

`reference/` is read-only input for the agent: never committed, never
written to. It holds:

- `reference/task-spec.md` — the tournament task brief.
- `reference/design-handoff/` — the design handoff bundle
  (`Room Booking.dc.html` + `_ds/`, `assets/`, etc.). This is the **1:1
  source of truth for all UI work** — match it, don't improvise.

## Monorepo layout

- `apps/api` — NestJS 11 (Express adapter). All routes under `/api`. In
  production this same process also serves the built SPA and owns routing
  for everything else (see `src/static/spa.controller.ts`).
- `apps/web` — Vite + React SPA. Builds to static assets only; ships no
  runtime Node dependencies.
- `packages/core` — Shared Zod schemas (`RoomSchema`, `NewRoomSchema`).
  Consumed by `apps/api` via the `@booking/core` workspace package —
  `db/seed.ts` validates seed rows through `NewRoomSchema` before insert;
  not yet consumed by `apps/web`.

## Pinned versions and why

- **Node 24** (`node:24-slim` in the Dockerfile) — current LTS.
- **TypeScript 5.9.3** — pinned below 7. TypeScript 7 exists on npm as of
  this writing (the native Go-based rewrite) but `ts-jest`'s installed
  version requires `typescript: >=4.3 <7`; 5.9.3 is also what `@nestjs/cli`
  itself depends on, so it's the natural common denominator.
- **drizzle-orm@0.45.2 / drizzle-kit@0.31.10, exact, no `^`** — a v1 release
  candidate exists on npm; do not upgrade to it without deliberately
  re-verifying the migration workflow below.

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
`apps/api/drizzle/`) and apply them with the **programmatic** `migrate()`
from `drizzle-orm/node-postgres/migrator`, wired into `apps/api/src/main.ts`
at process start, before the HTTP server starts listening. `push` introspects
the live database and can silently drop objects it can't model against the
Drizzle schema DSL — this schema already has one such object
(`CREATE EXTENSION IF NOT EXISTS btree_gist`, hand-added to the first
migration) and will eventually carry a hand-written `EXCLUDE` constraint for
booking overlap checks. `push` is not a shortcut here; it is actively unsafe.

## HARD RULE: all timestamps UTC; never hardcode Kyiv's offset

Store every timestamp in UTC. The office is `Europe/Kyiv`, but Kyiv is UTC+2
in winter and UTC+3 in summer (EU DST rules), and the *viewer's* zone may
switch DST on a different date than Kyiv does. Never write `+2` or `+3`
literally anywhere. Always compute the offset from the specific instant in
question (e.g. via `Intl.DateTimeFormat` with `timeZone: 'Europe/Kyiv'`, or
an equivalent tz-aware library call) — never from "today" or a cached value.
This skeleton has no timestamp columns yet (rooms only); this rule is
forward-looking for whoever adds bookings.

## Language split

UI strings are Ukrainian (see `apps/web/src/App.tsx`, the seed room names).
Everything else — code, identifiers, comments, commit messages — is English.

## Git discipline

Small, meaningful commits. Conventional Commits format
(`feat:`, `fix:`, `chore:`, `docs:`, ...). Every commit carries a
`Co-Authored-By: Claude` trailer. Never squash this history — a project
handed over as one commit is explicitly penalized by the brief this was
built against.

## Code hygiene

- No dead code, no unused exports.
- Every env var read in code must appear in `.env.example`, and vice versa
  — `apps/api/src/config/env.ts` (zod-validated) and
  `apps/api/drizzle.config.ts` are the only two places `process.env` is
  read directly; check both before adding or removing a variable.
- `apps/api/src/app.module.ts`'s `SpaController` wildcard route (`@All('*')`)
  must stay **last** in the `controllers` array — Nest matches controllers
  in array order, so anything registered after it is permanently shadowed.
  `nest generate controller` appends to the end of that array, so move
  `SpaController` back to last after generating anything new.
  `app.module.spec.ts` asserts this and will fail loudly if it regresses.

## Standing verification rule

`docker compose up --build` from a **clean clone** must succeed with no
manual steps, no crash loop, a green Postgres healthcheck before the app
starts, six seeded rooms, and idempotent behavior across
`docker compose down && docker compose up` — checked before any commit is
considered done. `npm test` must also pass at the repo root.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
