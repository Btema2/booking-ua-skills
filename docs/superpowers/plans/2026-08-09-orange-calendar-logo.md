# Orange Calendar Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace blue favicon and letter "П" logo mark with an orange calendar logo using brand terracotta orange (`#B2622D`).

**Architecture:** Update `public/favicon.svg` fill color and build a reusable React SVG component `CalendarLogo` to replace letter "П" in `AuthCard` and display next to the site header in `NavBar`.

**Tech Stack:** React, Vite, SVG, Vitest, Testing Library.

## Global Constraints

- Favicon and component background color: `#B2622D`.
- Icon vector lines color: `#F8FAFC`.
- ViewBox: `0 0 32 32`.

---

### Task 1: Update Favicon Asset

**Files:**
- Modify: `apps/web/public/favicon.svg`

**Interfaces:**
- Consumes: None
- Produces: Updated favicon SVG with `#B2622D` background fill.

- [ ] **Step 1: Update `favicon.svg` background fill**

Update `apps/web/public/favicon.svg` background `<rect>` fill attribute to `#B2622D`.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#B2622D"/>
  <rect x="7" y="9" width="18" height="16" rx="2" fill="none" stroke="#F8FAFC" stroke-width="2"/>
  <line x1="7" y1="14" x2="25" y2="14" stroke="#F8FAFC" stroke-width="2"/>
  <line x1="11" y1="6" x2="11" y2="11" stroke="#F8FAFC" stroke-width="2" stroke-linecap="round"/>
  <line x1="21" y1="6" x2="21" y2="11" stroke="#F8FAFC" stroke-width="2" stroke-linecap="round"/>
  <rect x="11" y="17" width="4" height="4" fill="#F8FAFC"/>
</svg>
```

- [ ] **Step 2: Commit changes**

```bash
git add apps/web/public/favicon.svg
git commit -m "feat(web): update favicon background to terracotta orange"
```

---

### Task 2: Create `CalendarLogo` Component and Unit Test

**Files:**
- Create: `apps/web/src/components/CalendarLogo.tsx`
- Create: `apps/web/src/components/CalendarLogo.test.tsx`

**Interfaces:**
- Consumes: `CalendarLogoProps { className?: string; size?: number }`
- Produces: `CalendarLogo` React component for website branding.

- [ ] **Step 1: Write the failing unit test**

Create `apps/web/src/components/CalendarLogo.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CalendarLogo } from './CalendarLogo';

describe('CalendarLogo', () => {
  it('renders SVG with correct attributes and orange fill', () => {
    const { container } = render(<CalendarLogo className="custom-class" size={24} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('height')).toBe('24');
    expect(svg?.getAttribute('class')).toContain('custom-class');

    const rect = svg?.querySelector('rect');
    expect(rect?.getAttribute('fill')).toBe('#B2622D');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/web -- src/components/CalendarLogo.test.tsx`
Expected: FAIL (Cannot find module `./CalendarLogo`)

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/components/CalendarLogo.tsx`:

```tsx
interface CalendarLogoProps {
  className?: string;
  size?: number;
}

export function CalendarLogo({ className = 'size-8', size }: CalendarLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" fill="#B2622D" />
      <rect x="7" y="9" width="18" height="16" rx="2" fill="none" stroke="#F8FAFC" strokeWidth="2" />
      <line x1="7" y1="14" x2="25" y2="14" stroke="#F8FAFC" strokeWidth="2" />
      <line x1="11" y1="6" x2="11" y2="11" stroke="#F8FAFC" strokeWidth="2" strokeLinecap="round" />
      <line x1="21" y1="6" x2="21" y2="11" stroke="#F8FAFC" strokeWidth="2" strokeLinecap="round" />
      <rect x="11" y="17" width="4" height="4" fill="#F8FAFC" />
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/web -- src/components/CalendarLogo.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add apps/web/src/components/CalendarLogo.tsx apps/web/src/components/CalendarLogo.test.tsx
git commit -m "feat(web): add CalendarLogo component"
```

---

### Task 3: Integrate `CalendarLogo` into `AuthCard.tsx` and `NavBar.tsx`

**Files:**
- Modify: `apps/web/src/features/auth/AuthCard.tsx:47-52`
- Modify: `apps/web/src/components/NavBar.tsx:77-82`

**Interfaces:**
- Consumes: `CalendarLogo` component from `apps/web/src/components/CalendarLogo.tsx`
- Produces: Updated branding visuals in Auth and Navigation headers.

- [ ] **Step 1: Update `AuthCard.tsx` to replace letter "П"**

Import `CalendarLogo` and replace:
```tsx
<div
  className="flex size-[var(--auth-mark-size)] items-center justify-center rounded-full shadow-[var(--auth-mark-shadow)] text-[var(--auth-mark-ink)] font-heading font-extrabold text-2xl tracking-wide"
  style={{ background: 'var(--auth-mark-face)' }}
>
  П
</div>
```
With:
```tsx
<CalendarLogo className="size-[var(--auth-mark-size)] rounded-full shadow-[var(--auth-mark-shadow)] shrink-0" />
```

- [ ] **Step 2: Update `NavBar.tsx` to include brand logo**

Import `CalendarLogo` and replace:
```tsx
<Link
  to="/"
  className={`shrink-0 rounded-full font-heading text-title-large text-on-surface max-desktop:hidden ${FOCUS_RING}`}
>
  Переговорні
</Link>
```
With:
```tsx
<Link
  to="/"
  className={`inline-flex items-center gap-2 shrink-0 rounded-full font-heading text-title-large text-on-surface max-desktop:hidden ${FOCUS_RING}`}
>
  <CalendarLogo className="size-7 rounded-md shrink-0" />
  <span>Переговорні</span>
</Link>
```

- [ ] **Step 3: Run test suite to verify tests pass**

Run: `npm run test -w apps/web -- src/components/CalendarLogo.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit changes**

```bash
git add apps/web/src/features/auth/AuthCard.tsx apps/web/src/components/NavBar.tsx
git commit -m "feat(web): replace letter П mark with orange CalendarLogo in AuthCard and NavBar"
```
