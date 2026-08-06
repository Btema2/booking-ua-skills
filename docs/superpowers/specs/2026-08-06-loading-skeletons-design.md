# High-Fidelity UI Loading Skeletons Design

## Goal

Improve loading skeletons across the application — specifically the Week Grid (`WeekGridStates.tsx`), Room List (`RoomListStates.tsx`), My Bookings (`MyBookingsPage.tsx`), and App Shell (`AppSkeleton.tsx`) — so they accurately resemble the actual live UI components while maintaining zero layout shift and fast performance under slow network connections.

---

## 1. Skeleton Primitives & `SkeletonBar` Fix

### Problem
`SkeletonBar` in `WeekGridStates.tsx` and `RoomListStates.tsx` hardcoded `rounded-full` in its element class list (`className="skeleton-bar block rounded-full ${className}"`). When applied to non-square blocks (e.g., booking blocks in the week grid that span multiple rows), CSS `border-radius: 9999px` renders large oval shapes/eggs instead of rectangular cards with rounded corners.

### Fix
- Remove `rounded-full` from the default `SkeletonBar` definition.
- Allow callers to pass explicit corner radius classes (e.g. `rounded-[var(--block-radius)]`, `rounded-md`, `rounded-full`, etc.).
- Default to `rounded-md` when no explicit radius is provided.

---

## 2. Week Grid Loading Skeleton (`WeekGridStates.tsx`)

### Geometry & Architecture
- **Outer Frame**: `rounded-[var(--radius-lg)] border border-outline-variant bg-surface-container-lowest overflow-clip`.
- **Header**:
  - Sticky header matching live `WeekGridHeader` geometry (`h-[var(--grid-head-h)]`).
  - Render actual Ukrainian day abbreviations (`ПН`, `ВТ`, `СР`, `ЧТ`, `ПТ`, `СБ`, `НД`) in time-zone/column headers with a subtle subtext bar skeleton for date numbers.
  - First cell (time gutter header) styled with `border-r border-outline-variant bg-surface-container`.
- **Time Gutter**:
  - Static hour labels (`09:00`, `10:00`, `11:00`, ... `18:00`) rendered hung at the top of each hour row using `text-label-small font-bold text-on-surface-variant`.
  - Zero animation overhead on static scale labels, providing instant visual orientation.
- **Grid Body & Rules**:
  - 20-row CSS grid (`repeat(20, var(--slot-h))`).
  - Hour lines: `border-t border-outline-variant`.
  - Half-hour lines: `border-t border-[var(--color-rule-half-hour)]`.
  - Vertical column dividers: `border-r border-outline-variant`.
- **Booking Block Skeletons**:
  - Render rectangular booking cards inside day columns using `rounded-[var(--block-radius)]` (9px desktop / 10px mobile) and `bg-surface-container` / `border border-outline-variant/40`.
  - Realistic staggered grid spans per day column (e.g. Day 1: 09:30–11:00 [rows 2–5] & 13:00–15:00 [rows 9–13]; Day 2: 10:00–12:00 [rows 3–7] & 14:30–16:00 [rows 12–15]; etc.).
  - Internal block skeleton detail:
    - Title text bar placeholder (`h-[13px] w-3/4 rounded-sm bg-surface-container-high`).
    - Meta text bar placeholder (`h-[10px] w-1/2 rounded-sm bg-surface-container-high`).

---

## 3. Room List Skeleton (`RoomListStates.tsx`)

### Geometry & Alignment
- Match live `RoomCard` layout 1:1 (`rounded-[var(--radius-lg)]` = 28px, border `border-outline-variant`, background `bg-surface-container-low`, padding `p-[var(--room-card-pad)]`).
- **Header**:
  - Room name skeleton bar (`h-[28px] w-3/5 rounded-md`).
  - Capacity badge placeholder: exact `size-[var(--room-cap-badge)]` (44px) circle (`rounded-full bg-surface-container-high`).
- **Body**:
  - Amenities text line skeleton (`h-[13px] w-4/5 rounded-sm`).
- **Footer**:
  - Floor tag pill skeleton (`h-[22px] w-[64px] rounded-full`).
  - Availability tag pill skeleton (`h-[22px] w-[130px] rounded-full`).

---

## 4. My Bookings Skeleton (`MyBookingsPage.tsx`)

### Geometry & Alignment
- Match live `MyBookingRow` card layout (`rounded-[var(--radius-md)] border border-outline-variant bg-surface-container-lowest p-s4`).
- **Left Icon Box**: `size-[40px] rounded-[var(--radius-sm)]` square skeleton.
- **Content Area**:
  - Title text skeleton bar (`h-4 w-48 rounded-md`).
  - Subtitle / room & floor text skeleton bar (`h-3 w-36 rounded-md`).
  - Date/time range pill skeleton on right (`h-6 w-32 rounded-full`).

---

## 5. Performance & CSS Shimmer

- Hardware-accelerated CSS keyframe animation (`skeleton-shimmer`) operating on `--pattern-skeleton` gradient sweep (1.35s linear infinite).
- Staggered `animation-delay` per column/card (`index * 0.08s`) for fluid visual sweep.
- `prefers-reduced-motion: reduce` compliance using existing `--dur-reduced` token override.
