# Бронювання переговорних / Meeting Room Booking

[Українська версія](README.uk.md) | **English Version**

A modern full-stack web application for booking office meeting rooms. Built as an npm workspaces monorepo featuring a single production Docker container serving both NestJS API routes and the React Single Page Application (SPA) backed by PostgreSQL 18 with Drizzle ORM.

---

## 1. Project Overview & Architecture

The application allows employees to view room schedules on an interactive weekly grid, book free 30-minute time slots, view and manage their upcoming/past bookings, and receive in-app notifications before their booking expires when the adjacent slot is taken.

### Monorepo Structure

- **`apps/api`**: NestJS 11 (Express adapter) application serving all backend routes under `/api`. Handles authentication, sessions, room management, booking validations, email verification, and notification scheduling. In production, it also serves the compiled SPA static files with fallback to `index.html` for deep links.
- **`apps/web`**: React 19 + Vite 8 SPA styled with Tailwind CSS v4 (CSS-first approach). Uses `@tanstack/react-query` for data fetching, `react-router` v8 for routing, and `react-hook-form` with Zod schemas for client-side forms.
- **`packages/core`**: Shared domain package containing Luxon-powered office hour calculations, week grid slot generators, DST-aware time utilities, and shared Zod validation schemas used by both frontend and backend.

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11, React 19, Vite 8 |
| Styling | Tailwind CSS v4 |
| Database & ORM | PostgreSQL 18, Drizzle ORM (`drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`) |
| Validation & Math | Zod v4, Luxon v3 |
| Package Manager | npm workspaces (Node.js >= 24) |

---

## 2. Quick Start with Docker Compose (Recommended)

Run the entire application (PostgreSQL 18 database + NestJS API + React SPA) with a single command from a clean machine:

```bash
cp .env.example .env
docker compose up --build
```

### Access Points
- **Web Application (SPA):** [http://localhost:3000](http://localhost:3000)
- **API Health Check:** [http://localhost:3000/api/health](http://localhost:3000/api/health)

### Automatic Initialization
When the container starts, it automatically:
1. Runs database migrations (`apps/api/dist/db/migrate.js`).
2. Seeds initial data (rooms, test users, and demo bookings) idempotently.

To reset or restart the containerized environment:
```bash
docker compose down && docker compose up
```

---

## 3. Local Development Setup (Without Docker)

### Prerequisites
- Node.js >= 24
- PostgreSQL 18 running locally

### Step-by-Step Instructions

1. **Environment Setup:**
   Copy `.env.example` to `.env` and adjust the PostgreSQL connection parameters if necessary:
   ```bash
   cp .env.example .env
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Build Monorepo Packages:**
   Compiles `@booking/core`, `@booking/web`, `@booking/api`, and copies web build artifacts:
   ```bash
   npm run build
   ```

4. **Start Development Servers:**
   - **Terminal 1 (API Server):**
     Starts NestJS in watch mode and runs migrations + seed automatically on startup:
     ```bash
     npm run dev:api
     ```
   - **Terminal 2 (Web SPA Dev Server):**
     Starts the Vite dev server with hot reload:
     ```bash
     npm run dev:web
     ```
     Open [http://localhost:5173](http://localhost:5173) in your browser.

5. **Generating Migrations (Drizzle):**
   If schema changes are made in `apps/api/src/db/schema.ts`, generate a new migration with:
   ```bash
   npm run db:generate
   ```

---

## 4. Test User Credentials

Two test user accounts are seeded into the database on boot. Both users are pre-verified so you can log in and start booking immediately without completing email verification:

| Email | Password | User Name | Initial Verification |
|---|---|---|---|
| `anna@example.com` | `password123` | Анна Мельник | Pre-verified |
| `bogdan@example.com` | `password123` | Богдан Ткач | Pre-verified |

---

## 5. Seed Data Mechanism

Seeding executes automatically during API boot (`npm run dev:api` or Docker container startup) and can also be invoked manually via `npm run db:seed -w apps/api`.

All seed operations use SQL `ON CONFLICT DO UPDATE` (upserting by unique key/fixed UUID) to guarantee complete idempotency without leaving stale or duplicate data across container restarts:

- **6 Meeting Rooms:**
  - **Дуб** (Floor 2, Capacity 12, Amenities: Проєктор, маркерна дошка)
  - **Ясен** (Floor 2, Capacity 8, Amenities: ТВ 55", вебкамера)
  - **Липа** (Floor 3, Capacity 4, Amenities: Тиха кімната для дзвінків)
  - **Верба** (Floor 3, Capacity 6, Amenities: ТВ, фліпчарт)
  - **Сосна** (Floor 4, Capacity 16, Amenities: Конференц-звук, трансляція)
  - **Клен** (Floor 4, Capacity 4, Amenities: Фокус-кімната)
- **2 Test Users:** Created with fixed deterministic UUIDs and pre-verified email status (`emailVerifiedAt = NOW()`).
- **7 Demo Bookings:** Dynamic dates relative to boot time — 5 upcoming bookings spread across the current Kyiv week, and 2 past bookings anchored in the previous week. This ensures both "Upcoming" and "Past" tabs in "My Bookings" (`/my-bookings`) contain entries regardless of what day the evaluator runs the project.

---

## 6. Running Tests

The repository includes unit, API integration, and E2E test suites.

### Unit Tests
Runs unit tests for `@booking/core`, `@booking/web`, and `@booking/api` (including Luxon slot calculations, Zod validations, capacity logic, and React component tests). Does not require PostgreSQL to be running.
```bash
npm test
```

### API Integration Tests
Requires a reachable PostgreSQL server — start it with `docker compose up -d db` (or run your own local instance matching `.env.example`). The suite (`apps/api/test/bookings.int-spec.ts` & `notifications.int-spec.ts`) creates and migrates the `booking_test` database itself on first run, so no manual database setup is needed beyond having Postgres running. Validates real HTTP requests for authentication, booking creation, back-to-back slot handling, overlap 409 errors, 403 authorization guards, email verification, series cancellation, and notifications.
```bash
docker compose up -d db
npm run test:integration
```

### API E2E Tests
Runs NestJS E2E tests (`apps/api/test/health.e2e-spec.ts`) verifying `/api/health`, JSON 404 responses for unknown API routes, and SPA HTML fallback for deep link routes:
```bash
npm run test:e2e -w apps/api
```

---

## 7. Email Verification Dev Flow

Real SMTP service is bypassed in development mode in favor of server log inspection:

1. **Registering a New User:** When registering a new account via `/register`, a unique verification token is created and printed directly to the server output (`docker compose logs api` or Terminal 1):
   `http://localhost:3000/verify/<token>`
2. **Completing Verification:** Opening the URL loads the SPA verification screen which sends a `POST /api/auth/verify/<token>` request to mark the user as verified.
3. **Server-Side Enforcement:** Unverified accounts are strictly blocked from creating bookings (`POST /api/bookings`) with an HTTP `403 Forbidden` response (`"Для створення бронювання необхідно підтвердити пошту"`).
4. **Resending Verification:** Logged-in unverified users can click "Надіслати ще раз" on the in-app banner (`POST /api/auth/verify/resend`) to generate and print a fresh link. Tokens expire after 24 hours.

---

## 8. Implemented §05 Bonus Features

Every optional bonus feature from §05 of `reference/task-spec.md` has been fully implemented:

1. **Docker Compose:** Single-command setup (`docker compose up --build`) building SPA and Nest API into one container alongside PostgreSQL 18 with automated migrations and seeding.
2. **Dev Email Verification:** Verification links logged to server stdout on registration; server strictly blocks unverified accounts from creating bookings (403).
3. **Weekly Recurring Bookings:** Support for creating weekly repeating bookings (2 to 52 occurrences) with options to cancel either a single occurrence or the entire series.
4. **Race Condition Protection:** PostgreSQL GiST exclusion constraint (`bookings_no_overlap`) on `(room_id, tstzrange)` prevents double-booking atomically at the DB level (returning 409).
5. **End-of-Booking Notifications:** In-app toast and bell notifications warn booking authors `NOTIFY_BEFORE_MINUTES` (default 10) before their slot ends if the next slot is occupied.
6. **API Integration Test Suite:** Comprehensive automated integration tests (`npm run test:integration`) covering HTTP endpoints for auth, validation, race conditions, series cancellation, and notifications.
7. **Room Capacity Filter:** Interactive capacity threshold filter (`Будь-яка` plus `від N` chips) on the room listing page. Thresholds are derived from the distinct capacities of the rooms that actually exist, not a hardcoded ladder — so a chip never produces an empty or a no-op result.
8. **Full Mobile Support:** Responsive UI featuring a dedicated single-day pager (`MobileDayPager`) on smaller screens and touch-friendly controls.

---

## 9. How Overlap Checking and Time Storage Work

### Overlap checking

Booking overlap prevention is enforced at the PostgreSQL storage layer with a GiST exclusion constraint (`bookings_no_overlap`): `EXCLUDE USING gist (room_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (canceled_at IS NULL)`. The half-open range `[)` means adjacent bookings (e.g. 10:00–11:00 and 11:00–12:00) don't clash, and the partial predicate `canceled_at IS NULL` lets a cancelled booking free its slot immediately. The application never takes an application-level lock (`SELECT FOR UPDATE`) — it relies on the constraint itself, catching the exclusion-violation SQLSTATE (`23P01`) and translating it into an HTTP 409 (`Слот зайнятий`). This is also what makes concurrent identical requests safe: two parallel `POST`s can both pass validation, but only one insert commits. Client and server schema validation (`packages/core/src/domain/overlap.ts`) additionally rejects obviously-overlapping requests before they reach the database, so the common case gets a fast, well-worded error instead of waiting on a constraint violation.

### Time storage and timezones

Every timestamp (`starts_at`, `ends_at`, `created_at`, `canceled_at`, `email_verified_at`) is stored as `timestamptz` in UTC — never a literal Kyiv offset. Office hours (09:00–19:00) and the week grid are computed against `Europe/Kyiv` using Luxon in `@booking/core`, because Kyiv's UTC offset changes with EU daylight saving and the viewer's own zone can shift DST on a different date. The browser renders every time in the viewer's local zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`); when that differs from Kyiv, the UI shows a banner with the office's current offset, while server-side validation (working hours, slot boundaries) always evaluates against Kyiv time for the specific instant in question.

---

## 10. Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Node environment (`development`, `production`, `test`) |
| `PORT` | `3000` | Port for NestJS server |
| `COOKIE_SECURE` | `false` | Set to `true` when serving over HTTPS to append `Secure` flag to session cookies |
| `POSTGRES_HOST` | `localhost` | PostgreSQL host (`db` inside Docker Compose) |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_USER` | `booking` | PostgreSQL database user |
| `POSTGRES_PASSWORD` | `booking` | PostgreSQL database password |
| `POSTGRES_DB` | `booking` | PostgreSQL database name |
| `TEST_DATABASE_URL` | *none* | Connection string used strictly during `npm run test:integration` |
| `NOTIFY_BEFORE_MINUTES` | `10` | Minutes before booking end to send in-app notification if next slot is taken |

---

## 11. AI Assistance

This project was built with the assistance of Claude (Anthropic), used throughout for implementation, review, and documentation. Commits authored with its help carry a `Co-Authored-By: Claude <noreply@anthropic.com>` trailer in the git history.
