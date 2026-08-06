# Phase 8.1 — Email Verification in Dev Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement email verification in dev mode for registration and booking creation, with printed verification URLs, resend capability, and frontend banner blocking.

**Architecture:** Database table `email_verification_tokens` stores 24h random tokens. `AuthService` handles token generation/verification/logging. Server-side `BookingsService.create` returns 403 if `emailVerifiedAt` is null. Frontend displays verification banner on rooms list and room schedule pages.

**Tech Stack:** NestJS 11, Drizzle ORM / drizzle-kit, React, TanStack Query, Vitest, Jest.

## Global Constraints
- `drizzle-kit push` is STRICTLY PROHIBITED. Only `drizzle-kit generate` (`npm run db:generate`) and programmatic `migrate()`.
- Verification link is printed to stdout as a full clickable URL (`http://localhost:3000/api/auth/verify/<token>`).
- Log lines must ONLY contain the URL — NEVER log token alongside user data, bcrypt hash, or email.
- Unverified booking creation returns HTTP 403 with distinct Ukrainian message.
- UI strings in Ukrainian, code/identifiers/comments/commits in English.

---

### Task 1: DB Schema & Migration

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Create: `apps/api/drizzle/0007_...sql` (generated via `npm run db:generate`)

**Interfaces:**
- Produces: `emailVerificationTokens` table schema in `apps/api/src/db/schema.ts`

- [ ] **Step 1: Update schema.ts**

Add `emailVerificationTokens` definition to `apps/api/src/db/schema.ts`:
```ts
export const emailVerificationTokens = pgTable('email_verification_tokens', {
  token: text('token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
```

- [ ] **Step 2: Generate Drizzle Migration**

Run: `npm run db:generate`
Expected: New migration file created under `apps/api/drizzle/`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat(db): add email_verification_tokens schema and migration"
```

---

### Task 2: Auth Repository Verification Token Methods

**Files:**
- Modify: `apps/api/src/auth/auth.repository.ts`
- Modify: `apps/api/src/auth/drizzle-auth.repository.ts`
- Modify: `apps/api/src/auth/drizzle-auth.repository.spec.ts`

**Interfaces:**
- Produces:
  `createVerificationToken(token: string, userId: string, expiresAt: Date): Promise<void>`
  `findVerificationToken(token: string): Promise<{ token: string; userId: string; expiresAt: Date } | null>`
  `deleteVerificationToken(token: string): Promise<void>`
  `deleteVerificationTokensForUser(userId: string): Promise<void>`
  `markEmailVerified(userId: string): Promise<void>`
  `findUserById(userId: string): Promise<UserRow | null>`

- [ ] **Step 1: Update AuthRepository interface in auth.repository.ts**

Add token types and methods to `AuthRepository`:
```ts
export interface VerificationTokenRow {
  token: string;
  userId: string;
  expiresAt: Date;
}
```

- [ ] **Step 2: Implement methods in DrizzleAuthRepository**

Implement `createVerificationToken`, `findVerificationToken`, `deleteVerificationToken`, `deleteVerificationTokensForUser`, `markEmailVerified`, `findUserById` in `drizzle-auth.repository.ts`.

- [ ] **Step 3: Update drizzle-auth.repository.spec.ts**

Add unit / integration specs or mock checks for token methods.

- [ ] **Step 4: Run repo tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/
git commit -m "feat(auth): add email verification repository methods"
```

---

### Task 3: Auth Errors & AuthService Token Logic

**Files:**
- Modify: `apps/api/src/auth/auth.errors.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.service.spec.ts`

**Interfaces:**
- Produces:
  `invalidOrExpiredVerificationToken()` error function
  `AuthService.verifyEmail(token: string): Promise<void>`
  `AuthService.resendVerificationEmail(userId: string): Promise<void>`

- [ ] **Step 1: Write failing unit tests in auth.service.spec.ts**

Add tests:
1. `register` creates token and logs URL (checking console.log / logger contains ONLY full URL).
2. Valid token verifies user and deletes token.
3. Expired / unknown / used token throws 400.
4. Already-verified user hitting verify again succeeds without error.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx jest apps/api/src/auth/auth.service.spec.ts`
Expected: FAIL

- [ ] **Step 3: Add error in auth.errors.ts and implement methods in AuthService**

In `auth.errors.ts`:
```ts
export function invalidOrExpiredVerificationToken(): BadRequestException {
  return new BadRequestException({ statusCode: 400, message: 'Токен підтвердження недійсний або прострочений' });
}
```
In `auth.service.ts`:
Implement `generateAndLogVerificationToken`, `verifyEmail`, `resendVerificationEmail`, and call `generateAndLogVerificationToken` in `register()`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest apps/api/src/auth/auth.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/
git commit -m "feat(auth): implement email verification logic in AuthService"
```

---

### Task 4: Auth Controller Endpoints & Tests

**Files:**
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.controller.spec.ts`

**Interfaces:**
- Produces:
  `POST /api/auth/verify/:token`
  `POST /api/auth/verify/resend`

- [ ] **Step 1: Write failing tests in auth.controller.spec.ts**

Test `POST /api/auth/verify/:token` and `POST /api/auth/verify/resend`.

- [ ] **Step 2: Implement endpoints in AuthController**

Add `@Post('verify/:token')` and `@Post('verify/resend')` with `@UseGuards(AuthGuard)`.

- [ ] **Step 3: Run controller tests**

Run: `npx jest apps/api/src/auth/auth.controller.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/auth/auth.controller.ts apps/api/src/auth/auth.controller.spec.ts
git commit -m "feat(auth): add verify and resend endpoints to AuthController"
```

---

### Task 5: Server-side Unverified Booking Creation Block

**Files:**
- Modify: `apps/api/src/bookings/bookings.errors.ts`
- Modify: `apps/api/src/bookings/bookings.service.ts`
- Modify: `apps/api/src/bookings/bookings.service.spec.ts`

**Interfaces:**
- Produces:
  `emailVerificationRequired()` error function returning 403 Forbidden with Ukrainian message.

- [ ] **Step 1: Write failing tests in bookings.service.spec.ts**

Test:
5. Booking creation by unverified user -> 403 with verification message (distinct from ownership 403).
6. Booking creation by verified user -> succeeds.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx jest apps/api/src/bookings/bookings.service.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement check in BookingsService**

Add `emailVerificationRequired()` to `bookings.errors.ts`:
```ts
export function emailVerificationRequired(): ForbiddenException {
  return new ForbiddenException({ statusCode: 403, message: 'Для створення бронювання необхідно підтвердити пошту' });
}
```
Check `if (!user.emailVerifiedAt)` in `BookingsService.create`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest apps/api/src/bookings/bookings.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/bookings/
git commit -m "feat(bookings): block booking creation for unverified users"
```

---

### Task 6: Frontend API, Banner Component & Page Integrations

**Files:**
- Modify: `apps/web/src/features/auth/api.ts`
- Create: `apps/web/src/features/auth/EmailVerificationBanner.tsx`
- Create: `apps/web/src/features/auth/EmailVerificationBanner.test.tsx`
- Modify: `apps/web/src/features/rooms/RoomsPage.tsx`
- Modify: `apps/web/src/features/rooms/RoomSchedulePage.tsx`

**Interfaces:**
- Produces:
  `EmailVerificationBanner` React component
  `verifyEmail` & `resendVerification` API functions in `apps/web/src/features/auth/api.ts`

- [ ] **Step 1: Add API functions in apps/web/src/features/auth/api.ts**

- [ ] **Step 2: Create EmailVerificationBanner.tsx**

Component showing warning banner with «Надіслати ще раз» button calling resend endpoint.

- [ ] **Step 3: Create Vitest tests in EmailVerificationBanner.test.tsx**

Test:
7. Unverified user sees banner; verified user does not.
8. Resend button calls endpoint and shows confirmation.

- [ ] **Step 4: Run web Vitest tests**

Run: `npm test -w apps/web`
Expected: PASS

- [ ] **Step 5: Integrate Banner into RoomsPage.tsx and RoomSchedulePage.tsx**

If unverified, display banner. In `RoomSchedulePage`, clicking free slot highlights banner instead of opening form.

- [ ] **Step 6: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add email verification banner and slot click blocking"
```

---

### Task 7: Full Verification & Acceptance Checks

- [ ] **Step 1: Run full test suite with Docker stopped**

Run: `npm test`
Expected: PASS across all 3 workspaces.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Successful build with dist files created.

- [ ] **Step 3: Run Docker Compose E2E test**

Run: `docker compose down -v && docker compose up --build -d`
- Register new user.
- Copy verification URL from `docker compose logs api`.
- Send POST to `/api/bookings` with curl for unverified user -> verify 403 with distinct message.
- Send POST to `/api/auth/verify/:token` via curl or browser to verify email.
- Send POST to `/api/bookings` with curl or UI -> verify 200 success.
- Test `docker compose down && docker compose up` (idempotence).

- [ ] **Step 4: Capture Screenshot of Banner at 1440px**

Take browser screenshot of 1440px viewport showing the unverified banner on room list or schedule page.
