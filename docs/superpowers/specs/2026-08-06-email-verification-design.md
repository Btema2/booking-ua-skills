# Email Verification (Phase 8.1) Design Spec

## 1. Goal & Architecture
Implement email verification in dev mode for registration and booking creation.
No real SMTP is used — confirmation links are logged directly to stdout.

## 2. Database Changes
New table `email_verification_tokens` in `apps/api/src/db/schema.ts`:
- `token`: `text('token').primaryKey()` (32 random bytes base64url)
- `userId`: `uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' })`
- `expiresAt`: `timestamp('expires_at', { withTimezone: true }).notNull()` (24 hours TTL)

Migration SQL generated via `npm run db:generate` (`drizzle-kit generate`) into `apps/api/drizzle/`, applied automatically on boot via programmatic `migrate()`. `drizzle-kit push` is strictly prohibited.

## 3. Backend API & Services

### Auth Repository (`apps/api/src/auth/auth.repository.ts`, `drizzle-auth.repository.ts`)
- `createVerificationToken(token: string, userId: string, expiresAt: Date): Promise<void>`
- `findVerificationToken(token: string): Promise<VerificationTokenRow | null>`
- `deleteVerificationToken(token: string): Promise<void>`
- `deleteVerificationTokensForUser(userId: string): Promise<void>`
- `markEmailVerified(userId: string): Promise<void>`

### Auth Service (`apps/api/src/auth/auth.service.ts`)
- On `register()`:
  - After user creation, calls `generateAndLogVerificationToken(user.id)`.
  - Invalidate previous tokens for `userId`, insert new token (expires in 24h).
  - Logs `http://localhost:3000/api/auth/verify/<token>` to stdout. Log line contains ONLY the URL (no user data, no bcrypt hash, no email).
- Method `verifyEmail(token: string)`:
  - Lookup token.
  - If token not found or `expiresAt <= new Date()`, throw 400 `invalidOrExpiredVerificationToken()` ("Токен підтвердження недійсний або прострочений").
  - Lookup user.
  - If user `emailVerifiedAt` is already set, delete token and return successfully (treat as success).
  - Otherwise, set `users.email_verified_at = new Date()`, delete token, and return successfully.
- Method `resendVerificationToken(userId: string)`:
  - Invalidate any existing verification token for `userId`.
  - Create new verification token (24h) and log URL `http://localhost:3000/api/auth/verify/<token>` to stdout.

### Auth Controller (`apps/api/src/auth/auth.controller.ts`)
- `POST /api/auth/verify/:token`: Calls `authService.verifyEmail(token)`. Returns `{ success: true }`.
- `POST /api/auth/verify/resend`: Protected by `AuthGuard`. Calls `authService.resendVerificationToken(user.id)`. Returns `{ success: true }`.

### Bookings Service (`apps/api/src/bookings/bookings.service.ts`)
- In `create(user: PublicUser, input: CreateBookingInput)`:
  - Check `if (!user.emailVerifiedAt)` (server-side check).
  - If null, throw 403 `emailVerificationRequired()` with Ukrainian message: `"Для створення бронювання необхідно підтвердити пошту"`. This message is distinct from `cannotCancelOthersBooking()` ("Ви можете скасовувати лише власні бронювання").

## 4. Frontend Component & Integration
- `EmailVerificationBanner.tsx` component in `apps/web/src/features/auth/`:
  - Shown on `RoomsPage` and `RoomSchedulePage` if `user && !user.emailVerifiedAt`.
  - Explains email verification requirement.
  - Has «Надіслати ще раз» button triggering `POST /api/auth/verify/resend` (via TanStack Mutation) and displaying a success message upon completion.
  - Exposes a ref or highlight state: if a user clicks a free slot in `RoomSchedulePage` while unverified, the booking form modal/drawer does not open; instead, the banner is highlighted and focused.
- Ukrainian strings throughout UI, styled with existing design system tokens.

## 5. Verification & Tests
- Jest unit tests in `apps/api`:
  1. Register creates token and logs URL (no bcrypt hash or email in log).
  2. Valid token sets `email_verified_at` and deletes token.
  3. Expired / unknown / re-used token returns 400.
  4. Hitting verify on already-verified user returns 200 success.
  5. Booking creation by unverified user returns 403 distinct message.
  6. Booking creation by verified user succeeds.
- Vitest tests in `apps/web`:
  7. Unverified user sees banner, verified user does not.
  8. Resend button calls resend API and shows confirmation message.
- E2E / Manual Docker verification:
  - Clean `docker compose down -v && docker compose up --build`.
  - Register new user.
  - Grab verification URL from `docker compose logs api`.
  - Attempt booking via curl / UI -> get 403.
  - Visit verification URL.
  - Attempt booking again -> succeeds.
  - `docker compose down && docker compose up` (idempotent migrations).
