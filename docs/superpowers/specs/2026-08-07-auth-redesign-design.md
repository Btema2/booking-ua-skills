# Design Specification: Authentication Pages & Verification UI Redesign

**Date**: 2026-08-07  
**Status**: Approved  
**Target Branch**: `redesign-auth-pages`  
**Scope**: Redesign `LoginPage`, `RegisterPage`, `VerifyEmailPage`, `AuthCard`, `TextField`, `FormError`, and `EmailVerificationBanner` to match the project's ceramic design system and tokens.

---

## 1. Goal & Requirements

Redesign the authentication pages (`/login`, `/register`, `/verify/:token`) and the in-app `EmailVerificationBanner` to strictly adhere to the project's organic ceramic design system (`apps/web/src/styles/tokens.css` and `docs/DESIGN-NOTES.md`).

### Key Design Requirements:
1. **Wood Ground & Ceramic Card**: Wrap all auth pages in a full-viewport container with wood desk background gradients and vignette (`--auth-wood-*`), centering a curved ceramic tile (`--auth-ceramic-*`).
2. **2-Column Layout on Desktop (≥761px)**:
   - **Left Panel**: Ceramic mark logo (`П` icon in `--auth-mark-*`), kicker `ПЕРЕГОВОРНІ`, page headline, subtitle, room list (`Дуб · Ясен · Липа · Верба · Сосна · Клен`), and schedule metadata (`2–4 поверхи · 09:00–19:00 за київським часом`).
   - **Center Divider**: Vertical gradient line (`--auth-divider`).
   - **Right Panel**: Ceramic well inputs (`--auth-well-*`), brown terracotta glaze primary button (`--auth-glaze-primary-*`), and dark oak footer links (`--color-on-primary-container`).
3. **Mobile Layout (≤760px)**:
   - Single-column stacked layout with responsive padding (`--auth-ceramic-pad-mobile`), smaller radius (`--auth-ceramic-radius-mobile`: 32px), and hidden vertical divider.
4. **Behavioral Integrity**:
   - Retain full form state, error handling, Zod validation, keyboard accessibility (`aria-*`), and test coverage.

---

## 2. Component Design & Token Map

### 2.1 `AuthCard.tsx`
- **Container**: `min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8` with background `var(--auth-wood-desk)` plus layered pseudo-elements/background-images for `--auth-wood-grain-a`, `--auth-wood-grain-b`, `--auth-wood-glow`, and `--auth-wood-vignette`.
- **Tile Section**:
  - `bg-[var(--auth-ceramic-face)]`
  - `rounded-[var(--auth-ceramic-radius-mobile)] sm:rounded-[var(--auth-ceramic-radius)]` (32px / 52px)
  - `shadow-[var(--auth-ceramic-lift)]`
  - `box-shadow` rim `var(--auth-ceramic-rim)`
  - Inner glaze overlay `linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,0))` (`--auth-ceramic-glaze`)
- **Inner Grid**:
  - `grid grid-cols-1 min-[761px]:grid-cols-[minmax(0,1fr)_1px_minmax(0,380px)] gap-y-8 min-[761px]:gap-x-14`
- **Left Column**:
  - Logo circle: `w-[56px] h-[56px] rounded-full flex items-center justify-center bg-[var(--auth-mark-face)] shadow-[var(--auth-mark-shadow)] text-[var(--auth-mark-ink)] font-extrabold text-2xl`
  - Kicker: `text-xs font-bold tracking-[0.08em] uppercase text-[#a85f2e]`
  - Heading: `font-heading text-display-medium font-extrabold text-on-surface text-[clamp(30px,7vw,44px)] leading-[1.06]`
  - Subtitle: `font-body text-body-medium text-on-surface-variant`
  - Metadata footer: `text-body-small text-on-surface-variant/80`
- **Divider**: `hidden min-[761px]:block w-[1px] h-full bg-[var(--auth-divider)]`
- **Right Column**: Form or status content container.

### 2.2 `TextField.tsx`
- Label: `block text-label-medium font-bold text-on-surface-variant mb-1`
- Input: `w-full rounded-full bg-[var(--auth-well-bg)] border border-[rgba(120,78,40,.22)] shadow-[var(--auth-well-shadow)] min-h-[50px] px-5 py-3 text-on-surface placeholder:text-outline text-body-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all`
- Error Input State: `border-2 border-[var(--color-error)] text-[var(--color-error)]`
- Error Text: `mt-1 text-body-small text-[var(--color-error)] font-medium px-3`

### 2.3 `FormError.tsx`
- Banner: `rounded-2xl border border-[var(--color-error)]/20 bg-[var(--color-error-container)] px-4 py-3 text-body-medium font-medium text-[var(--color-on-error-container)]`

### 2.4 `AuthSubmitButton` & `AuthFooterLink`
- Primary Button: `w-full rounded-full bg-[var(--auth-glaze-primary)] shadow-[var(--auth-glaze-primary-shadow)] text-[var(--auth-glaze-primary-ink)] min-h-[52px] px-6 py-3 text-label-large font-semibold hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed`
- Footer Link: `text-body-medium text-[var(--color-on-primary-container)] font-bold underline hover:opacity-80 transition-opacity`

### 2.5 `VerifyEmailPage.tsx`
- Layout: Reuses `AuthCard` ceramic tile with left panel heading `Підтвердження email`.
- Right Panel:
  - Pending: Shimmering block / text `Підтверджуємо пошту…`
  - Success: `SuccessIcon` with `--color-primary-container` background and `До кімнат` / `Увійти` action button styled with `--auth-glaze-primary`.
  - Error: `ErrorIcon` with `--color-error-container` background, error message text, and retry guidance.

### 2.6 `EmailVerificationBanner.tsx`
- Responsive pill banner in app layout using `--color-surface-container-high`, `--color-primary`, `--color-on-surface`, and `--color-on-primary-container` resend button.

---

## 3. Error Handling & Accessibility

- **Form State Retention**: Failed submission catches keep input state unchanged.
- **Accessibility**: All `aria-invalid`, `aria-describedby`, `htmlFor`, and `role="alert"` attributes are preserved. Focus rings cleared with high-contrast outlines (`focus-visible:ring-2 focus-visible:ring-primary/40`).

---

## 4. Verification Plan

1. **Unit & Integration Tests**: `npm test` across all workspaces.
2. **Build Verification**: `npm run build` (core -> web -> api).
3. **Full Stack Verification**: `docker compose up --build` from clean clone.
4. **Visual Screenshots**: Generate mobile and desktop screenshots using Puppeteer/Playwright or headful browser test to confirm zero layout regressions and perfect ceramic aesthetics.
