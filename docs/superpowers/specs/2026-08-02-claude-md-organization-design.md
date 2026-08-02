# CLAUDE.md organization update — design

Purpose: prep CLAUDE.md for the Phase 1–9 build (`docs/SPEC.md`) now that
skeleton work is done. No new tracker file — phase state stays in memory +
`git log`, per user decision.

## Changes to `apps/../booking-ua-skills-task/CLAUDE.md`

1. **Build spec pointer** (near top, after skeleton intro): `docs/SPEC.md` is
   authoritative for *how* Phase 1–9 are built; `reference/task-spec.md`
   (task brief) wins on *what* must exist if they disagree. Carry forward
   SPEC.md's own rule: read only the phase currently being worked, don't
   read ahead.

2. **Drop stale "no auth, no bookings" framing** — replace with: skeleton
   phase done, build now follows `docs/SPEC.md` §7 phases.

3. **Phase workflow section** — the loop: new session → code phase → verify
   → fix if broken → next phase.
   - new session: check `git log` for last phase commit, read that phase's
     section in SPEC.md §7 only.
   - code phase: multi-agent dynamic execution for independent tasks within
     the phase.
   - verify: run that phase's literal *Accept* checks from SPEC.md §7 +
     standing rule (`npm test`, clean `docker compose up --build`). Show
     output, don't assert.
   - fix if broken: debug loop back into code phase, broken piece only.
   - next phase: conventional commit, move on.

4. **Critical constraints list** (compact, pointer-style, not duplicating
   SPEC.md detail):
   - overlap: DB `EXCLUDE` constraint, `'[)'` half-open range, catch
     `err.code === '23P01'` (never message text) → 409
   - no calendar library — disqualifying per brief
   - Luxon 3 for TZ math, never `Temporal` (Safari gap)
   - grid columns = office days (Kyiv), row labels in viewer zone
   - own-vs-other booking: shape/text signal too, not color alone; 7:1
     contrast floor in grid

5. **Design-handoff extraction note** — after Phase 2,
   `apps/web/src/styles/tokens.css` + `docs/DESIGN-NOTES.md` are the working
   reference; don't re-open the handoff HTML unless something's missing from
   both.

6. **Pinned-versions pattern note** — one line: when Luxon/Tailwind
   4/React Router/TanStack Query/react-hook-form land, pin exact + reason,
   following the existing table's pattern.

## Out of scope
- No `docs/PROGRESS.md` or other tracker file (user: memory + git log is enough).
- No changes to `docs/SPEC.md` itself.
