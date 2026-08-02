# CLAUDE.md Organization Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax
> for tracking. (Single-file doc edit — subagent-driven-development is
> unnecessary overhead here.)

**Goal:** Update `CLAUDE.md` so a fresh session orients correctly for the
Phase 1–9 build (`docs/SPEC.md`) instead of the now-finished skeleton phase.

**Architecture:** One file, six edits: rewrite the stale intro, add a
build-spec precedence section, add a phase-workflow-loop section, add a
critical-constraints section, extend the existing design-handoff bullet, and
extend the existing pinned-versions section. No code changes, no new files.

**Tech Stack:** Markdown only.

## Global Constraints

- Source of truth for every added line: `docs/SPEC.md` (already read in
  full) and `docs/superpowers/specs/2026-08-02-claude-md-organization-design.md`
  (the approved design). Do not introduce content not traceable to one of
  the two.
- No new tracker file (`docs/PROGRESS.md` explicitly rejected by user).
- Keep additions compact — user asked to minimize token footprint.
- English only (CLAUDE.md is code/docs, not UI).

---

### Task 1: Rewrite CLAUDE.md for the Phase 1–9 build

**Files:**
- Modify: `CLAUDE.md:1-133` (full file, six localized edits below)

**Interfaces:** None — standalone documentation file, no consumers to keep in sync.

- [ ] **Step 1: Rewrite the stale intro (lines 3–6)**

Replace:
```markdown
This is a **skeleton**: npm workspaces monorepo, one Docker image, Postgres
alongside it. No auth, no bookings — only enough to prove the cold path
(clone → build → migrate → seed → serve) is unbreakable before real features
land on top of it.
```
With:
```markdown
This started as a **skeleton** (npm workspaces monorepo, one Docker image,
Postgres alongside it) proving the cold path — clone → build → migrate →
seed → serve — unbreakable before real features landed. That phase is done.
Build now proceeds through `docs/SPEC.md`'s Phase 1–9 (auth, rooms UI,
bookings, the week grid, mobile, bonuses).
```

- [ ] **Step 2: Add a build-spec precedence section, right after the existing `## reference/` section (after line 19, before `## Monorepo layout`)**

Insert:
```markdown
## docs/SPEC.md — authoritative build spec

`docs/SPEC.md` decides **how** Phase 1–9 are built. `reference/task-spec.md`
(the tournament brief) decides **what** must exist — where the two disagree,
the brief wins on *what*, SPEC.md wins on *how*. SPEC.md enforces a rule on
itself: read only the phase currently being worked, don't read ahead. Carry
that rule into every session here too.

## Phase workflow

Loop per `docs/SPEC.md` §7 phase: **new session → code phase → verify → fix
if broken → next phase.**

- **New session** — check `git log` for the last phase commit, then read
  that phase's section in SPEC.md §7 only.
- **Code phase** — dynamic multi-agent execution for the phase's independent
  tasks, not solo sequential work.
- **Verify** — run that phase's literal *Accept* checks from SPEC.md §7,
  plus the standing rule below (`npm test`, clean `docker compose up
  --build`). Show command output — never assert success unexecuted.
- **Fix if broken** — debug loop back into the code phase, touching only the
  broken piece.
- **Next phase** — conventional commit, move to the next phase.

## Critical constraints (Phase 1–9)

Full detail in `docs/SPEC.md`; these are the ones easiest to violate by habit:

- Overlap: DB `EXCLUDE` constraint, `'[)'` half-open range (never `'[]'`),
  catch `err.code === '23P01'` (never message text) → HTTP 409.
- No calendar library (FullCalendar etc.) — disqualifying per the brief.
- Luxon 3 for timezone math, never `Temporal` (unsupported on Safari/iOS).
- Week grid columns are office days (Kyiv calendar); row labels render in
  the viewer's zone — never one fixed offset applied to the whole week.
- Own-vs-other booking distinguished by shape/text too, never colour alone;
  7:1 contrast floor inside the grid.
```

- [ ] **Step 3: Extend the design-handoff bullet inside `## reference/`**

Append to the existing `reference/design-handoff/` bullet (after "match it,
don't improvise."):
```markdown
  After Phase 2, work from the extracted `apps/web/src/styles/tokens.css`
  and `docs/DESIGN-NOTES.md` instead — reopen the handoff only if something
  is missing from both.
```

- [ ] **Step 4: Extend `## Pinned versions and why`**

Append a new bullet at the end of that section's list:
```markdown
- When later phases add **Luxon 3**, **Tailwind 4**, **React Router**,
  **TanStack Query**, or **react-hook-form** — pin exact + one-line reason
  here, following the pattern above.
```

- [ ] **Step 5: Verify the edit**

Run:
```bash
grep -c '^## ' CLAUDE.md
```
Expected: 12 (was 9 — three new `##` sections added: "docs/SPEC.md —
authoritative build spec", "Phase workflow", "Critical constraints
(Phase 1–9)").

Run:
```bash
grep -n 'No auth, no bookings' CLAUDE.md
```
Expected: no output (stale line removed).

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: update CLAUDE.md for the Phase 1-9 build

Skeleton phase is done. Point sessions at docs/SPEC.md as the authoritative
build spec, document the new-session/code-phase/verify/fix/next-phase loop,
list the constraints easiest to violate by habit, and extend the existing
design-handoff and pinned-versions sections for what Phase 1-9 adds.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
