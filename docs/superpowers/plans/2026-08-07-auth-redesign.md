# Auth Pages Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `AuthCard`, `LoginPage`, `RegisterPage`, `VerifyEmailPage`, `TextField`, `FormError`, and `EmailVerificationBanner` to match the ceramic tile & wood background design tokens (`apps/web/src/styles/tokens.css` and `docs/DESIGN-NOTES.md`).

**Architecture:** A shared 2-column ceramic card (`AuthCard`) rendered on a warm wood background ground. Desktop (≥761px) displays left branding panel, center divider, and right form panel; Mobile (≤760px) stacks single-column with reduced padding and smaller radius.

**Tech Stack:** React 19, Vite, TailwindCSS 4 with CSS custom properties (`var(--auth-*)`), Zod, Vitest.

## Global Constraints

- **Theme Tokens**: Use CSS variables from `tokens.css` (`var(--auth-wood-desk)`, `var(--auth-ceramic-face)`, `var(--auth-well-bg)`, `var(--auth-glaze-primary)`, etc.).
- **Typography**: Display headings use Rubik (`font-heading`), body text uses Onest (`font-body`).
- **Breakpoints**: Desktop at `>= 761px`, Mobile at `<= 760px`.
- **Form State**: Keep form input values intact on server 400/401 errors.
- **Verification**: All `npm test` tests must pass; `docker compose up --build` must start cleanly; visual screenshots generated.

---

### Task 1: Redesign `AuthCard.tsx` Container

**Files:**
- Modify: `apps/web/src/features/auth/AuthCard.tsx`
- Test: `apps/web/src/features/auth/AuthForms.test.tsx`

**Interfaces:**
- Consumes: CSS custom properties from `tokens.css`
- Produces: `AuthCard({ title, subtitle, children, footer }: AuthCardProps)`, `AuthFooterLink`, `AuthSubmitButton`

- [ ] **Step 1: Write updated test assertions if needed**

Check existing tests in `AuthForms.test.tsx` and ensure card headings and roles are targeted by accessible labels.

- [ ] **Step 2: Implement ceramic `AuthCard` in `AuthCard.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Link } from 'react-router';

type AuthCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <main
      className="relative flex min-h-screen w-full items-center justify-center p-4 sm:p-6 lg:p-8 overflow-x-hidden"
      style={{
        backgroundImage: `
          var(--auth-wood-vignette),
          var(--auth-wood-glow),
          var(--auth-wood-grain-a),
          var(--auth-wood-grain-b),
          var(--auth-wood-desk)
        `,
        backgroundBlendMode: 'normal, normal, var(--auth-wood-grain-blend), var(--auth-wood-grain-blend), normal',
        backgroundPosition: 'center center',
        backgroundSize: 'cover',
      }}
    >
      <section
        className="relative w-full max-w-[960px] overflow-hidden rounded-[var(--auth-ceramic-radius-mobile)] sm:rounded-[var(--auth-ceramic-radius)] bg-[var(--auth-ceramic-face)] p-[var(--auth-ceramic-pad-mobile)] sm:p-[var(--auth-ceramic-pad)] shadow-[var(--auth-ceramic-lift)]"
        style={{
          boxShadow: 'var(--auth-ceramic-rim), var(--auth-ceramic-lift)',
        }}
      >
        {/* Inner glaze highlight */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[var(--auth-ceramic-glaze-h)] rounded-[var(--auth-ceramic-glaze-radius)] bg-[var(--auth-ceramic-glaze)]"
          aria-hidden="true"
        />

        <div className="relative z-10 grid grid-cols-1 min-[761px]:grid-cols-[minmax(0,1fr)_1px_minmax(0,380px)] min-[761px]:gap-x-14 gap-y-8 items-stretch">
          {/* Left Column: Branding & Info */}
          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex size-[var(--auth-mark-size)] items-center justify-center rounded-full bg-[var(--auth-mark-face)] shadow-[var(--auth-mark-shadow)] text-[var(--auth-mark-ink)] font-heading font-extrabold text-2xl tracking-wide">
                П
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#a85f2e]">
                  ПЕРЕГОВОРНІ
                </p>
                <h1 className="mt-1 font-heading text-[clamp(28px,5vw,44px)] font-extrabold leading-[1.06] text-[var(--color-on-surface)]">
                  {title}
                </h1>
                <p className="mt-2 font-body text-body-medium text-[var(--color-on-surface-variant)]">
                  {subtitle ?? 'Увійдіть, щоб побачити розклад переговорних.'}
                </p>
              </div>
            </div>

            <div className="border-t border-[rgba(120,78,40,.14)] pt-4 text-body-small text-[var(--color-on-surface-variant)]/80 space-y-1">
              <p>Дуб · Ясен · Липа · Верба · Сосна · Клен</p>
              <p>2–4 поверхи · 09:00–19:00 за київським часом</p>
            </div>
          </div>

          {/* Center Divider Line */}
          <div
            className="hidden min-[761px]:block w-[1px] h-full bg-[var(--auth-divider)]"
            aria-hidden="true"
          />

          {/* Right Column: Form and Actions */}
          <div className="flex flex-col justify-center">
            {children}
            <div className="mt-6 text-center text-body-medium">{footer}</div>
          </div>
        </div>
      </section>
    </main>
  );
}

export function AuthFooterLink({ question, to, label }: {
  question: string;
  to: string;
  label: string;
}) {
  return (
    <p className="text-body-medium text-[var(--color-on-surface-variant)]">
      {question}{' '}
      <Link
        to={to}
        className="font-bold text-[var(--color-on-primary-container)] underline hover:opacity-80 transition-opacity"
      >
        {label}
      </Link>
    </p>
  );
}

export function AuthSubmitButton({ pending, label, pendingLabel }: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-[var(--auth-glaze-primary)] shadow-[var(--auth-glaze-primary-shadow)] text-[var(--auth-glaze-primary-ink)] min-h-[var(--auth-glaze-primary-min-h)] px-6 py-3 text-label-large font-semibold hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
```

- [ ] **Step 3: Run Vitest to verify AuthCard changes**

Run: `npx vitest run apps/web/src/features/auth/AuthForms.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit Task 1**

```bash
git add apps/web/src/features/auth/AuthCard.tsx
git commit -m "feat(web): update AuthCard to ceramic 2-column layout with wood background"
```

---

### Task 2: Redesign `TextField.tsx` and `FormError.tsx`

**Files:**
- Modify: `apps/web/src/components/TextField.tsx`
- Modify: `apps/web/src/components/FormError.tsx`
- Test: `apps/web/src/features/auth/AuthForms.test.tsx`

**Interfaces:**
- Consumes: Ceramic well styling variables (`--auth-well-*`)
- Produces: `TextField` with ceramic well input style, `FormError` with error container styling

- [ ] **Step 1: Update `TextField.tsx` with ceramic well inputs**

```tsx
import type { UseFormRegisterReturn } from 'react-hook-form';

type TextFieldProps = {
  label: string;
  type: 'text' | 'email' | 'password';
  autoComplete: string;
  error?: string;
  registration: UseFormRegisterReturn;
};

export function TextField({ label, type, autoComplete, error, registration }: TextFieldProps) {
  const id = registration.name;
  const errorId = `${id}-error`;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-label-medium font-bold text-[var(--color-on-surface-variant)]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        placeholder={
          type === 'email'
            ? "ім'я@example.com"
            : type === 'password'
            ? 'Мінімум 8 символів'
            : ''
        }
        className={`w-full rounded-full bg-[var(--auth-well-bg)] border border-[rgba(120,78,40,.22)] shadow-[var(--auth-well-shadow)] min-h-[var(--auth-well-min-h)] px-5 py-3 text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] text-body-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 focus:border-[var(--color-primary)] transition-all ${
          error ? 'border-2 border-[var(--color-error)] text-[var(--color-error)]' : ''
        }`}
        {...registration}
      />
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-body-small text-[var(--color-error)] font-medium px-3">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Update `FormError.tsx` with error container banner**

```tsx
export function FormError({ message }: { message: string | null }) {
  if (message === null) {
    return null;
  }
  return (
    <p
      role="alert"
      className="rounded-2xl border border-[var(--color-error)]/20 bg-[var(--color-error-container)] px-4 py-3 text-body-medium font-medium text-[var(--color-on-error-container)] shadow-sm"
    >
      {message}
    </p>
  );
}
```

- [ ] **Step 3: Run Vitest to verify component tests**

Run: `npx vitest run apps/web/src/features/auth/AuthForms.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit Task 2**

```bash
git add apps/web/src/components/TextField.tsx apps/web/src/components/FormError.tsx
git commit -m "feat(web): redesign TextField and FormError with ceramic well inputs"
```

---

### Task 3: Update `LoginPage.tsx` and `RegisterPage.tsx`

**Files:**
- Modify: `apps/web/src/features/auth/LoginPage.tsx`
- Modify: `apps/web/src/features/auth/RegisterPage.tsx`
- Test: `apps/web/src/features/auth/AuthForms.test.tsx`

- [ ] **Step 1: Update `LoginPage.tsx` subtitle & title**

```tsx
export function LoginPage() {
  return (
    <AuthCard
      title="Забронюйте кімнату"
      subtitle="Увійдіть, щоб побачити розклад переговорних."
      footer={<AuthFooterLink question="Немає облікового запису?" to="/register" label="Зареєструватися" />}
    >
      <LoginForm />
    </AuthCard>
  );
}
```

- [ ] **Step 2: Update `RegisterPage.tsx` subtitle & title**

```tsx
export function RegisterPage() {
  return (
    <AuthCard
      title="Створіть акаунт"
      subtitle="Зареєструйтеся, щоб бронювати кімнати для зустрічей."
      footer={<AuthFooterLink question="Вже маєте акаунт?" to="/login" label="Увійти" />}
    >
      <RegisterForm />
    </AuthCard>
  );
}
```

- [ ] **Step 3: Run Vitest tests**

Run: `npx vitest run apps/web/src/features/auth/AuthForms.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit Task 3**

```bash
git add apps/web/src/features/auth/LoginPage.tsx apps/web/src/features/auth/RegisterPage.tsx
git commit -m "feat(web): align LoginPage and RegisterPage copy and titles with design handoff"
```

---

### Task 4: Redesign `VerifyEmailPage.tsx` and `EmailVerificationBanner.tsx`

**Files:**
- Modify: `apps/web/src/features/auth/VerifyEmailPage.tsx`
- Modify: `apps/web/src/features/auth/EmailVerificationBanner.tsx`
- Test: `apps/web/src/features/auth/VerifyEmailPage.test.tsx`
- Test: `apps/web/src/features/auth/EmailVerificationBanner.test.tsx`

- [ ] **Step 1: Refactor `VerifyEmailPage.tsx` with ceramic status elements**

```tsx
import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { AuthCard } from './AuthCard';
import { useVerifyEmailMutation } from './useAuthMutations';
import { useCurrentUser } from './useCurrentUser';
import { ApiError } from '../../lib/api';

const ICON_CIRCLE = 'flex size-[52px] items-center justify-center rounded-full shadow-sm';

function SuccessIcon() {
  return (
    <span className={`${ICON_CIRCLE} bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)]`}>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-[24px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9.5" />
        <path d="m8 12 3 3 5-6" />
      </svg>
    </span>
  );
}

function ErrorIcon() {
  return (
    <span className={`${ICON_CIRCLE} bg-[var(--color-error-container)] text-[var(--color-on-error-container)]`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[24px]" fill="none">
        <path
          d="M12 4.5l8.5 15h-17l8.5-15z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M12 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1.1" fill="currentColor" />
      </svg>
    </span>
  );
}

export function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const { data: user } = useCurrentUser();
  const verify = useVerifyEmailMutation();
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current || !token) {
      return;
    }
    requested.current = true;
    verify.mutate(token);
  }, [token, verify]);

  const continueTo = user ? '/' : '/login';
  const continueLabel = user ? 'До кімнат' : 'Увійти';

  return (
    <AuthCard
      title="Підтвердження email"
      subtitle="Перевіряємо ваш поштовий ящик для доступу до бронювань."
      footer={
        <Link
          to={continueTo}
          className="inline-flex w-full items-center justify-center rounded-full bg-[var(--auth-glaze-primary)] shadow-[var(--auth-glaze-primary-shadow)] text-[var(--auth-glaze-primary-ink)] min-h-[var(--auth-glaze-primary-min-h)] px-6 py-3 text-label-large font-semibold hover:brightness-105 transition-all"
        >
          {continueLabel}
        </Link>
      }
    >
      <div className="py-4 flex flex-col items-center gap-4 text-center">
        {verify.isPending || verify.isIdle ? (
          <p className="text-body-medium text-[var(--color-on-surface-variant)] animate-pulse">Підтверджуємо пошту…</p>
        ) : verify.isSuccess ? (
          <>
            <SuccessIcon />
            <p className="text-body-medium font-medium text-[var(--color-on-surface)]">
              Пошту підтверджено. Тепер можна створювати бронювання.
            </p>
          </>
        ) : (
          <>
            <ErrorIcon />
            <div className="space-y-1">
              <p className="text-body-medium font-medium text-[var(--color-on-surface)]">
                {verify.error instanceof ApiError
                  ? verify.error.message
                  : 'Не вдалося підтвердити пошту.'}
              </p>
              <p className="text-body-small text-[var(--color-on-surface-variant)]">
                Увійдіть в акаунт і надішліть нове посилання.
              </p>
            </div>
          </>
        )}
      </div>
    </AuthCard>
  );
}
```

- [ ] **Step 2: Update `EmailVerificationBanner.tsx` design**

```tsx
import { useMutation } from '@tanstack/react-query';
import { resendVerificationToken } from './api';
import { useCurrentUser } from './useCurrentUser';

export interface EmailVerificationBannerProps {
  readonly highlighted?: boolean;
  readonly id?: string;
  readonly className?: string;
}

export function EmailVerificationBanner({
  highlighted = false,
  id = 'email-verification-banner',
  className = '',
}: EmailVerificationBannerProps) {
  const { data: user } = useCurrentUser();
  const resendMutation = useMutation({
    mutationFn: resendVerificationToken,
  });

  if (!user || user.emailVerifiedAt) {
    return null;
  }

  const baseStyles =
    'flex flex-wrap items-center justify-between gap-s3 rounded-2xl border p-s4 text-body-medium transition-all duration-300 shadow-sm';
  const stateStyles = highlighted
    ? 'border-[var(--color-primary)] bg-[var(--color-surface-container-high)] ring-2 ring-[var(--color-primary)] scale-[1.01]'
    : 'border-[var(--color-outline-variant)] bg-[var(--color-surface-container-low)] text-[var(--color-on-surface)]';

  return (
    <div
      id={id}
      tabIndex={-1}
      role="region"
      aria-label="Підтвердження електронної пошти"
      className={`${baseStyles} ${stateStyles} ${className}`.trim()}
    >
      <div className="flex items-center gap-s3">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-[22px] shrink-0 text-[var(--color-primary)]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="font-medium">
          Для створення бронювань необхідно підтвердити електронну пошту.
        </span>
      </div>

      <div>
        {resendMutation.isSuccess ? (
          <span className="font-semibold text-[var(--color-primary)]">
            Посилання надіслано! Перевірте консоль сервера
          </span>
        ) : (
          <button
            type="button"
            disabled={resendMutation.isPending}
            onClick={() => resendMutation.mutate()}
            className="cursor-pointer rounded-full border border-[var(--color-on-primary-container)] bg-[var(--color-on-primary-container)] px-s4 py-s2 text-label-medium font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-on-primary-container)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resendMutation.isPending ? 'Надіслано...' : 'Надіслати ще раз'}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run Vitest tests for verification components**

Run: `npx vitest run apps/web/src/features/auth/VerifyEmailPage.test.tsx apps/web/src/features/auth/EmailVerificationBanner.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit Task 4**

```bash
git add apps/web/src/features/auth/VerifyEmailPage.tsx apps/web/src/features/auth/EmailVerificationBanner.tsx
git commit -m "feat(web): update VerifyEmailPage and EmailVerificationBanner with ceramic design tokens"
```

---

### Task 5: Full Stack Verification & Screenshot Generation

**Files:**
- Touch: `apps/web/src/test/auth-visual-check.spec.ts` (temporary test or script if needed)

- [ ] **Step 1: Run full unit test suite**

Run: `npm test`
Expected: PASS across all workspaces (@booking/core, @booking/web, @booking/api).

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Success with no TypeScript or Vite build errors.

- [ ] **Step 3: Test Docker build**

Run: `docker compose up --build -d`
Expected: Container starts cleanly and passes health check.

- [ ] **Step 4: Capture UI Screenshots for verification**

Write a script or run dev server to render `/login`, `/register`, `/verify/demo-token` at `1280x800` (desktop) and `390x844` (mobile) viewport sizes, saving screenshots to `docs/screenshots/` or artifact directory.

- [ ] **Step 5: Final Git Commit & Cleanup**

```bash
git add .
git commit -m "chore: verify auth redesign passes tests, docker build, and visual inspection"
```
