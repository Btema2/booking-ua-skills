# Phase 7 — Mobile (Single-Day Pager & Responsive 390px Layout) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Candidate A (Single-Day Pager) for the room schedule grid below 761px breakpoint, a mobile bottom bar, and ensure all screens render seamlessly without horizontal scroll or clipped text at any viewport width from 320px to 1440px.

**Architecture:** 
- A custom hook `useIsMobile(761)` / media query detects `vw < 761` in JS to conditionally render `MobileDayPager` vs `WeekGridShell` (7-column week grid) in `RoomSchedulePage.tsx`.
- `MobileDayPager` displays a 7-day chip pager strip (`repeat(7,1fr)`) and a single 20-row day grid column (`52px minmax(0,1fr)` track, `56px` slot height, scrollable container with `max-height: min(68vh,640px)`).
- Selecting a day updates searchParams (`day=YYYY-MM-DD`), preserving the selection across reloads and remounts.
- `BottomBar` renders on mobile (`< 761px`) with nav items ("Кімнати", "Мої бронювання") and a CTA pill ("Забронювати") on schedule pages or logout button.
- Booking blocks on mobile utilize mobile-specific tokens (cell padding `3px 8px`, radius `10px`, block padding `9px 12px` / `7px 11px`, title `14px/13px`, dot `8px`, glyph `11px`, meta letter-spacing `.03em`) and always-visible `+` for free slots.

**Tech Stack:** React 19, TypeScript 5.9, Vite, Tailwind CSS 4, Luxon 3, Vitest, Playwright (browser subagent).

## Global Constraints
- Grid switches to single-day pager in JS at `vw < 761`. Desktop is `vw >= 761`. Breakpoint `max-width: 760px` in CSS.
- Candidate A (Single-Day Pager) ONLY. Candidate B MUST NOT be built.
- No horizontal scroll and no clipped text at ANY width from 320px to 1440px (320, 360, 390, 420, 600, 760, 761, 1024, 1440).
- Ukrainian UI text.
- Standard unit tests in Vitest with zero DB requirement (`npm test`).

---

### Task 1: Viewport & Day Selection Hook and BookingBlock Mobile Presentation

**Files:**
- Create: `apps/web/src/lib/useIsMobile.ts`
- Modify: `apps/web/src/features/rooms/BookingBlock.tsx:1-185`
- Test: `apps/web/src/features/rooms/BookingBlock.test.tsx`

**Interfaces:**
- Consumes: `getViewerZone`, `Booking` schema
- Produces: `useIsMobile(breakpoint?: number): boolean`, `BookingBlock` with `isMobile` support.

- [ ] **Step 1: Create `useIsMobile` hook**
  Create `apps/web/src/lib/useIsMobile.ts` using `window.matchMedia('(max-width: 760px)')` / `window.innerWidth < 761` with listener cleanup.

- [ ] **Step 2: Update `BookingBlock` for mobile presentation**
  Add `isMobile?: boolean` to `BookingBlockProps`.
  When `isMobile` is true:
  - Cell padding: `px-[8px] py-[3px]` (`--cell-pad-mobile`).
  - Radius: `rounded-[10px]` (`--block-radius-mobile`).
  - Block padding: span >= 2 ? `px-[12px] py-[9px]` : `px-[11px] py-[7px]`.
  - Title size: span >= 2 ? `text-[14px]` : `text-[13px]`.
  - Dot: `size-[8px]`. Glyph: `size-[11px]`.
  - Free slot on mobile: `rounded-full` (pill radius 999px), `border-[1.5px] border-dashed border-outline-variant bg-transparent`, always-visible `+` icon (not hover-only).
  - Own vs other non-color signals: 4 signals preserved (2px solid primary border + filled dot + "Ви" text for own; 1px border + 4px left bar + outline person glyph + first name for other).

- [ ] **Step 3: Write Vitest unit tests in `BookingBlock.test.tsx`**
  Verify non-color signals and always-visible `+` on mobile.

---

### Task 2: Mobile Day Pager Component (`MobileDayPager.tsx`)

**Files:**
- Create: `apps/web/src/features/rooms/MobileDayPager.tsx`
- Test: `apps/web/src/features/rooms/MobileDayPager.test.tsx`

**Interfaces:**
- Consumes: `daysKyiv: DateTime[]`, `selectedDayIndex: number`, `onSelectDayIndex: (idx: number) => void`, `renderDayColumn`
- Produces: `MobileDayPager` component rendering 7-chip strip and single-day column frame with now line.

- [ ] **Step 1: Create `MobileDayPager.tsx`**
  - Day pager strip: `grid grid-cols-7 gap-[5px]` (`--pager-gap`), chips with radius `14px`, padding `8px 2px 7px`, min-height `48px`, `.14s` transition.
  - Chip contents: DOW `text-[10px] font-bold uppercase tracking-[0.05em]`, Day number Rubik `text-[17px] font-heading leading-[1.1]`.
  - Chip states:
    - Active: `bg-primary text-on-primary`
    - Today (when not active): `bg-[var(--glass-today-head-pager)] text-on-surface` (`color-mix(#ffd0b4 65%)`)
    - Inactive: `bg-surface-container-high/50 text-on-surface-variant`
  - Single-day column frame:
    - Track: `grid grid-cols-[52px_minmax(0,1fr)]` (`--grid-columns-mobile`)
    - Frame: `border border-outline-variant rounded-[var(--radius-lg)] bg-surface-container-lowest overflow-y-auto max-h-[min(68vh,640px)]`
    - 20 rows, row height `56px` (`var(--slot-h-mobile)`).
    - Time gutter: `52px` wide, gutter label `11px/700`, padding `3px 8px 0 0`.
    - Now indicator line: `left: 52px; right: 0; height: 2px; bg-error`, `10px` dot at `left: -5px`. Same office hours and today-only rules as desktop grid.

- [ ] **Step 2: Write tests in `MobileDayPager.test.tsx`**
  Verify 7 chips rendering, active state, single day column 20 rows, gutter labels.

---

### Task 3: Integrate Mobile Pager & URL Day Sync in `RoomSchedulePage.tsx`

**Files:**
- Modify: `apps/web/src/features/rooms/RoomSchedulePage.tsx`
- Test: `apps/web/src/features/rooms/Phase7Mobile.test.tsx`

- [ ] **Step 1: Integrate `useIsMobile` and `MobileDayPager` into `RoomSchedulePage.tsx`**
  - Detect `isMobile = useIsMobile(761)`.
  - Read `day` param from `searchParams` (e.g. `day=YYYY-MM-DD`). Match with `daysKyiv` index; default to today if in current week, else index 0.
  - When user clicks a day chip, update `searchParams` with `day=YYYY-MM-DD` (preserving `week` param).
  - If `isMobile` is true, render `MobileDayPager`; otherwise render `WeekGridShell` (7-column week grid).

- [ ] **Step 2: Write Vitest tests in `Phase7Mobile.test.tsx`**
  Test all 5 required Vitest checks:
  1. Below 761px pager renders and 7-column grid does not; at >=761px reverse.
  2. Selecting a day updates URL and survives remount.
  3. Mobile day column renders 20 rows + gutter labels.
  4. Free rows on mobile render visible `+` without hover.
  5. Own vs other booking carries all 4 non-color signals at mobile sizes.

---

### Task 4: Mobile Bottom Bar Component & Layout Polish

**Files:**
- Create: `apps/web/src/components/BottomBar.tsx`
- Modify: `apps/web/src/components/NavBar.tsx`
- Modify: `apps/web/src/features/auth/RequireAuth.tsx`
- Modify: `apps/web/src/features/bookings/MyBookingsPage.tsx`
- Modify: `apps/web/src/features/auth/AuthCard.tsx`

- [ ] **Step 1: Create `BottomBar.tsx`**
  - Render fixed bottom bar at `< 761px`: `fixed bottom-0 left-0 right-0 z-40 p-[12px_16px_16px] border-t border-outline-variant bg-[var(--glass-toast-fallback)] supports-[backdrop-filter]:bg-[var(--glass-toast)] supports-[backdrop-filter]:backdrop-blur-[14px] supports-[backdrop-filter]:backdrop-saturate-[1.2]`.
  - Height ~76px.
  - Nav items: 60px wide, 19px icon, 10px/700 uppercase label.
    - "Кімнати" -> `/`
    - "Мої" -> `/my-bookings`
  - CTA button / Logout button visible so persistent nav requirement is fulfilled.

- [ ] **Step 2: Polish App Bar & Other Screens for 320px..760px**
  - App bar: padding `10px 14px` <=760px, gap `8px` <=420px, timezone chip hidden <=760px, brand text hidden <=420px, tab padding `8px 10px`, `13px`.
  - Room list & filter: chips flex wrap, 1 column layout below ~620px without horizontal scroll.
  - My Bookings: rows stack to column at <=760px, padding `14px 16px`, cancel button full width.
  - Create booking modal & Cancel dialog: flex/scrollable layout ensuring submit buttons are reachable on 390px screens without clipping.
  - Auth screens at 390px: tile padding `36px 22px 30px` <=760px, radius `32px` <=760px.

---

### Task 5: Comprehensive Verification & Screenshot Audit

**Files:**
- Execute: `npm test`, `npm run build`, `docker compose up --build`
- Execute: Browser subagent checks at 320, 360, 390, 420, 600, 760, 761, 1024, 1440.

- [ ] **Step 1: Run `npm test` & `npm run build`**
- [ ] **Step 2: Run `docker compose up --build`**
- [ ] **Step 3: Launch Browser Subagent**
  - Log in as seeded user with bookings in current week.
  - Take 390x760 screenshots of:
    - Room list
    - Week pager
    - Create form modal
    - Cancel confirmation dialog
    - My bookings
    - Login screen
  - Perform touch booking & touch cancellation.
  - Test `document.documentElement.scrollWidth <= window.innerWidth` across all 9 target breakpoints (320, 360, 390, 420, 600, 760, 761, 1024, 1440).
  - Verify clean browser console throughout.
- [ ] **Step 4: Present 390px screenshots to user before committing.**

## Verification Plan
### Automated Tests
- `npm test` (runs Vitest in `apps/web` and `packages/core` without DB)

### Manual Verification
- Browser subagent taking screenshots at 390x760 and checking `scrollWidth <= innerWidth` across 320px..1440px viewports.
