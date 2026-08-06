# High-Fidelity UI Loading Skeletons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign loading skeletons in `WeekGridStates.tsx`, `RoomListStates.tsx`, `MyBookingsPage.tsx`, and `AppSkeleton.tsx` to accurately mimic live UI components with high structural fidelity, static time labels, realistic card geometries, zero layout shift, and instant CSS shimmer performance.

**Architecture:** Remove forced `rounded-full` from base `SkeletonBar` primitives so rectangular containers use precise radii (`rounded-[var(--block-radius)]` = 9px/10px, `rounded-[var(--radius-lg)]` = 28px). Render static time labels (`09:00`–`18:00`) and standard day headers in the week grid to anchor layout instantly, with staggered rectangular booking block cards in grid slots.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS 4, Vitest, Testing Library React.

## Global Constraints

- **No calendar libraries**: No external calendar JS libraries (FullCalendar, etc.).
- **Timezone**: All timestamps in UTC; time rendering aware of Kyiv/viewer offsets; never hardcode `+2` or `+3`.
- **Skeleton shimmer**: Pure CSS `.skeleton-bar` with `--pattern-skeleton` animation (1.35s linear infinite).
- **Reduced motion**: Collapse shimmer animation under `prefers-reduced-motion: reduce`.

---

### Task 1: Refactor `SkeletonBar` primitive radius behavior

**Files:**
- Modify: `apps/web/src/features/rooms/WeekGridStates.tsx:7-20`
- Modify: `apps/web/src/features/rooms/RoomListStates.tsx:30-38`
- Test: `apps/web/src/features/rooms/WeekGridStates.test.tsx`

**Interfaces:**
- Consumes: `.skeleton-bar` CSS rule in `styles.css`.
- Produces: `SkeletonBar({ className, delay }: { readonly className?: string; readonly delay?: string })` without hardcoded `rounded-full` base class.

- [ ] **Step 1: Write test for SkeletonBar default rounding**

Modify `apps/web/src/features/rooms/WeekGridStates.test.tsx` to add a test ensuring `SkeletonBar` does not force `rounded-full` when explicit radius classes like `rounded-md` or `rounded-[var(--block-radius)]` are supplied:

```tsx
import { DefaultFallbackGrid, SkeletonBar, WeekGridError, WeekGridLoading } from './WeekGridStates';

it('renders SkeletonBar with provided rounding classes instead of forcing rounded-full', () => {
  const { container } = render(<SkeletonBar className="h-4 w-12 rounded-[var(--block-radius)]" />);
  const span = container.querySelector('span');
  expect(span?.className).toContain('rounded-[var(--block-radius)]');
  expect(span?.className).not.toContain('rounded-full');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/src/features/rooms/WeekGridStates.test.tsx`
Expected: FAIL because `SkeletonBar` currently hardcodes `rounded-full`.

- [ ] **Step 3: Update `SkeletonBar` in `WeekGridStates.tsx` and `RoomListStates.tsx`**

In `apps/web/src/features/rooms/WeekGridStates.tsx`:
```tsx
export function SkeletonBar({
  className = '',
  delay,
}: {
  readonly className?: string;
  readonly delay?: string;
}) {
  const roundedClass = className.includes('rounded-') ? '' : 'rounded-md';
  return (
    <span
      className={`skeleton-bar block ${roundedClass} ${className}`.trim()}
      style={delay ? { animationDelay: delay } : undefined}
    />
  );
}
```

In `apps/web/src/features/rooms/RoomListStates.tsx`:
```tsx
export function SkeletonBar({
  className = '',
  delay,
}: {
  readonly className?: string;
  readonly delay?: string;
}) {
  const roundedClass = className.includes('rounded-') ? '' : 'rounded-md';
  return (
    <span
      className={`skeleton-bar block ${roundedClass} ${className}`.trim()}
      style={delay ? { animationDelay: delay } : undefined}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/src/features/rooms/WeekGridStates.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/rooms/WeekGridStates.tsx apps/web/src/features/rooms/RoomListStates.tsx apps/web/src/features/rooms/WeekGridStates.test.tsx
git commit -m "refactor(web): remove hardcoded rounded-full from SkeletonBar primitive"
```

---

### Task 2: High-Fidelity Week Grid Skeleton Redesign

**Files:**
- Modify: `apps/web/src/features/rooms/WeekGridStates.tsx:33-118`
- Test: `apps/web/src/features/rooms/WeekGridStates.test.tsx`

**Interfaces:**
- Consumes: `WeekGridLoading({ daysCount }: WeekGridLoadingProps)`
- Produces: Redesigned `WeekGridLoading` component with static time gutter labels (`09:00`–`18:00`), Ukrainian day column headers, 20-row grid rules, and realistic staggered rectangular booking blocks.

- [ ] **Step 1: Write failing tests for WeekGridLoading structural fidelity**

Add tests to `apps/web/src/features/rooms/WeekGridStates.test.tsx` checking for time gutter hour labels and day column headers:

```tsx
it('renders static time labels (09:00 to 18:00) in time gutter', () => {
  render(<WeekGridLoading daysCount={7} />);
  expect(screen.getByText('09:00')).toBeTruthy();
  expect(screen.getByText('12:00')).toBeTruthy();
  expect(screen.getByText('18:00')).toBeTruthy();
});

it('renders Ukrainian day headers (ПН to НД) in loading skeleton', () => {
  render(<WeekGridLoading daysCount={7} />);
  expect(screen.getByText('ПН')).toBeTruthy();
  expect(screen.getByText('ВТ')).toBeTruthy();
  expect(screen.getByText('НД')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/src/features/rooms/WeekGridStates.test.tsx`
Expected: FAIL with "Unable to find text 09:00".

- [ ] **Step 3: Implement redesigned `WeekGridLoading` in `WeekGridStates.tsx`**

Replace `WeekGridLoading` in `apps/web/src/features/rooms/WeekGridStates.tsx`:

```tsx
const DAY_LABELS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'НД'];
const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

// Staggered booking block slot positions per day column (gridRow span rules)
const STAGGERED_BOOKINGS: Array<Array<{ row: string; span: string }>> = [
  [{ row: '2 / span 3' }, { row: '9 / span 4' }],   // Day 0 (ПН): 09:30-11:00, 13:00-15:00
  [{ row: '3 / span 4' }, { row: '12 / span 3' }],  // Day 1 (ВТ): 10:00-12:00, 14:30-16:00
  [{ row: '1 / span 3' }, { row: '8 / span 4' }],   // Day 2 (СР): 09:00-10:30, 12:30-14:30
  [{ row: '4 / span 4' }, { row: '14 / span 3' }],  // Day 3 (ЧТ): 10:30-12:30, 15:30-17:00
  [{ row: '2 / span 4' }, { row: '10 / span 3' }],  // Day 4 (ПТ): 09:30-11:30, 13:30-15:00
  [{ row: '5 / span 3' }],                           // Day 5 (СБ): 11:00-12:30
  [{ row: '3 / span 3' }],                           // Day 6 (НД): 10:00-11:30
];

export function WeekGridLoading({ daysCount = 7 }: WeekGridLoadingProps) {
  const days = Array.from({ length: daysCount });

  return (
    <div role="status" aria-busy="true" className="w-full">
      <p className="mb-s2 text-body-small font-medium text-on-surface-variant">
        Завантажуємо розклад…
      </p>

      <div className="overflow-clip rounded-[var(--radius-lg)] border border-outline-variant bg-surface-container-lowest">
        {/* Sticky Header Skeleton */}
        <div
          className="grid border-b border-outline-variant bg-surface-container"
          style={{ gridTemplateColumns: `var(--time-gutter-w) repeat(${daysCount}, minmax(0, 1fr))` }}
        >
          <div className="h-[var(--grid-head-h)] border-r border-outline-variant p-s2" />
          {days.map((_, index) => (
            <div
              key={index}
              className="flex h-[var(--grid-head-h)] flex-col items-center justify-center gap-1 border-r border-outline-variant p-s2 last:border-r-0"
            >
              <span className="text-label-small font-bold text-on-surface-variant">
                {DAY_LABELS[index % DAY_LABELS.length]}
              </span>
              <SkeletonBar className="h-3.5 w-6 rounded-full" delay={`${index * 0.05}s`} />
            </div>
          ))}
        </div>

        {/* Grid Body Skeleton keeping full 20-row grid geometry */}
        <div
          className="grid overflow-hidden"
          style={{
            gridTemplateColumns: `var(--time-gutter-w) repeat(${daysCount}, minmax(0, 1fr))`,
            gridTemplateRows: 'repeat(20, var(--slot-h))',
          }}
        >
          {/* Time Gutter with static hour labels */}
          <div
            className="grid border-r border-outline-variant bg-surface-container-lowest"
            style={{ gridTemplateRows: 'repeat(20, var(--slot-h))' }}
          >
            {Array.from({ length: 20 }, (_, rowIndex) => {
              const isHourRow = rowIndex % 2 === 0;
              const hourText = HOURS[Math.floor(rowIndex / 2)];
              return (
                <div
                  key={rowIndex}
                  className={
                    isHourRow
                      ? 'border-t border-outline-variant px-s2 pt-[2px] text-right text-label-small font-bold text-on-surface-variant tabular-nums'
                      : 'border-t border-[var(--color-rule-half-hour)]'
                  }
                >
                  {isHourRow ? hourText : null}
                </div>
              );
            })}
          </div>

          {/* Day Columns with realistic rectangular booking card skeletons */}
          {days.map((_, colIndex) => {
            const bookings = STAGGERED_BOOKINGS[colIndex % STAGGERED_BOOKINGS.length];
            return (
              <div
                key={colIndex}
                className="relative grid border-r border-outline-variant p-[var(--cell-pad)] last:border-r-0"
                style={{ gridTemplateRows: 'repeat(20, var(--slot-h))' }}
              >
                {bookings.map((b, bIdx) => (
                  <div
                    key={bIdx}
                    className="col-span-1 flex flex-col justify-between rounded-[var(--block-radius)] border border-outline-variant/40 bg-surface-container p-s2 shadow-xs"
                    style={{ gridRow: b.row }}
                  >
                    <SkeletonBar className="h-3 w-3/4 rounded-xs bg-surface-container-high" delay={`${(colIndex * 2 + bIdx) * 0.08}s`} />
                    <SkeletonBar className="h-2.5 w-1/2 rounded-xs bg-surface-container-high" delay={`${(colIndex * 2 + bIdx) * 0.08 + 0.04}s`} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/src/features/rooms/WeekGridStates.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/rooms/WeekGridStates.tsx apps/web/src/features/rooms/WeekGridStates.test.tsx
git commit -m "feat(web): improve week grid loading skeleton with static hour labels and realistic booking cards"
```

---

### Task 3: Redesign Room List Skeleton (`RoomListStates.tsx`)

**Files:**
- Modify: `apps/web/src/features/rooms/RoomListStates.tsx:40-69`
- Test: `apps/web/src/features/rooms/RoomListStates.test.tsx` (create or update)

**Interfaces:**
- Consumes: `RoomListLoading()` component
- Produces: `SkeletonCard` matching `RoomCard` layout 1:1 (room title bar, capacity circle badge, amenities line, floor tag pill, availability tag pill).

- [ ] **Step 1: Write test for RoomListLoading card layout**

Create `apps/web/src/features/rooms/RoomListStates.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoomListLoading } from './RoomListStates';

describe('RoomListLoading', () => {
  it('renders status region with skeleton list items matching room cards', () => {
    render(<RoomListLoading />);
    const status = screen.getByRole('status');
    expect(status).toBeTruthy();
    expect(screen.getByText('Завантажуємо переговорні…')).toBeTruthy();
    const listItems = screen.getAllByRole('listitem', { hidden: true });
    expect(listItems.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it passes/fails as baseline**

Run: `npx vitest run apps/web/src/features/rooms/RoomListStates.test.tsx`

- [ ] **Step 3: Update `SkeletonCard` in `RoomListStates.tsx`**

Update `SkeletonCard` in `apps/web/src/features/rooms/RoomListStates.tsx`:

```tsx
/** Keeps the card's own shape, padding, and inner badge elements so nothing jumps when data loads. */
function SkeletonCard({ delay }: { readonly delay: string }) {
  return (
    <li
      aria-hidden="true"
      className="flex flex-col gap-[var(--room-card-gap)] rounded-[var(--radius-lg)] border border-outline-variant bg-surface-container-low p-[var(--room-card-pad)]"
    >
      {/* Header: Name + Capacity Circle */}
      <div className="flex items-start justify-between gap-s3">
        <div className="flex w-full flex-col gap-s2">
          <SkeletonBar className="h-[28px] w-3/5 rounded-md" delay={delay} />
          <SkeletonBar className="h-[13px] w-4/5 rounded-sm" delay={delay} />
        </div>
        <SkeletonBar className="size-[var(--room-cap-badge)] shrink-0 rounded-full" delay={delay} />
      </div>

      {/* Footer: Floor tag pill + Availability tag pill */}
      <div className="flex flex-wrap items-center gap-s2 pt-s1">
        <SkeletonBar className="h-[24px] w-[64px] rounded-full" delay={delay} />
        <SkeletonBar className="h-[24px] w-[130px] rounded-full" delay={delay} />
      </div>
    </li>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/src/features/rooms/RoomListStates.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/rooms/RoomListStates.tsx apps/web/src/features/rooms/RoomListStates.test.tsx
git commit -m "feat(web): upgrade RoomList skeleton card to match room card geometry 1:1"
```

---

### Task 4: Upgrade My Bookings & App Shell Skeletons

**Files:**
- Modify: `apps/web/src/features/bookings/MyBookingsPage.tsx:30-47`
- Modify: `apps/web/src/components/AppSkeleton.tsx:10-30`
- Test: `apps/web/src/features/bookings/MyBookingsPage.test.tsx`
- Test: `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `MyBookingsSkeleton`, `AppSkeleton`
- Produces: High-fidelity loading state placeholders matching MyBookings rows and main shell app bar layout.

- [ ] **Step 1: Write test for MyBookingsSkeleton rendering**

Check `apps/web/src/features/bookings/MyBookingsPage.test.tsx` for loading state test assertions and add test for skeleton row elements:

```tsx
it('renders MyBookingsSkeleton status region with row card placeholders', () => {
  render(<MyBookingsSkeleton />);
  expect(screen.getByRole('status')).toBeTruthy();
  expect(screen.getByLabelText('Завантаження')).toBeTruthy();
});
```

- [ ] **Step 2: Update `MyBookingsSkeleton` in `MyBookingsPage.tsx`**

In `apps/web/src/features/bookings/MyBookingsPage.tsx`:

```tsx
function MyBookingsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Завантаження" className="flex flex-col gap-s3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-s4 rounded-[var(--radius-md,16px)] border border-outline-variant bg-surface-container-lowest p-s4 max-[760px]:flex-col max-[760px]:items-start max-[760px]:p-[14px_16px]"
        >
          <div className="flex items-center gap-s4 w-full">
            <span className="skeleton-bar block size-[40px] shrink-0 rounded-[var(--radius-sm,8px)]" />
            <div className="flex flex-1 flex-col gap-s2">
              <span className="skeleton-bar block h-4 w-44 rounded-md" />
              <span className="skeleton-bar block h-3 w-32 rounded-sm" />
            </div>
          </div>
          <span className="skeleton-bar block h-7 w-32 shrink-0 rounded-full max-[760px]:w-full" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Update `AppSkeleton.tsx`**

In `apps/web/src/components/AppSkeleton.tsx`:

```tsx
export function AppSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Завантаження" className="min-h-screen bg-surface">
      <div className="border-b-[length:var(--border-hairline)] border-outline-variant bg-[var(--glass-appbar-fallback)]">
        <div className="mx-auto flex h-[var(--appbar-h)] w-full max-w-[var(--page-max)] items-center gap-[var(--appbar-gap)] p-[var(--appbar-pad)] max-desktop:gap-[var(--appbar-gap-mobile)] max-desktop:p-[var(--appbar-pad-mobile)]">
          <span className="skeleton-bar block h-6 w-36 rounded-md" />
          <div className="ml-auto flex items-center gap-s3">
            <span className="skeleton-bar block h-8 w-24 rounded-full [animation-delay:0.1s]" />
            <span className="skeleton-bar block size-9 rounded-full [animation-delay:0.15s]" />
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[var(--page-max)] flex-col gap-s4 px-[var(--page-pad-x)] pt-[var(--page-pad-top)] pb-[var(--page-pad-bottom)]">
        <span className="skeleton-bar block h-10 w-48 rounded-md" />
        <span className="skeleton-bar block h-4 w-full max-w-xl rounded-sm [animation-delay:0.15s]" />
        <span className="skeleton-bar block h-64 w-full rounded-[var(--radius-lg)] [animation-delay:0.25s]" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run full web unit test suite**

Run: `npm --workspace=apps/web test`
Expected: PASS (all tests pass green).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/bookings/MyBookingsPage.tsx apps/web/src/components/AppSkeleton.tsx apps/web/src/features/bookings/MyBookingsPage.test.tsx
git commit -m "feat(web): enhance MyBookings and AppSkeleton layout fidelity"
```

---

### Task 5: Monorepo Full Verification & Build Check

**Files:**
- None (verification task)

- [ ] **Step 1: Run workspace test suite across core, web, and api**

Run: `npm test`
Expected: PASS across all workspaces.

- [ ] **Step 2: Run production build check**

Run: `npm run build`
Expected: Successful build producing `apps/api/dist/public` static bundle without errors.

- [ ] **Step 3: Update knowledge graph**

Run: `graphify update .` (or `npx graphify update .` if graphify CLI is available).

- [ ] **Step 4: Commit any graph updates if needed**

```bash
git add graphify-out/
git commit -m "chore: update knowledge graph following loading skeleton redesign"
```
