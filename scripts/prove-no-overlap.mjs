#!/usr/bin/env node
// Proves the DB-level EXCLUDE constraint — not application code — is what
// stops two overlapping bookings from ever coexisting. Fires two identical
// POSTs concurrently and expects exactly one 201, one 409, and one row.
//
// Plain Node ESM, no dependencies beyond global `fetch` (Node >=18).

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

const KYIV_ZONE = 'Europe/Kyiv';
const OFFICE_OPEN_HOUR = 9;
const OFFICE_CLOSE_HOUR = 19;
const SLOT_MINUTES = 30;
const BOOKING_MINUTES = 60;
const FUTURE_BUFFER_MINUTES = 15; // headroom so "strictly future" survives the HTTP round trips
const MAX_DAYS_AHEAD = 30; // generous ceiling; a real free slot is expected within a day or two

// Fixed account, reused across runs: a rerun logs in instead of re-registering.
// The booking title (not the account) is what makes a rerun self-identifying.
const USER_EMAIL = 'prove-race@example.com';
const USER_NAME = 'Prove Race';
const USER_PASSWORD = 'ProveRace123!';

const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const BOOKING_TITLE = `PROVE-RACE-${runId}`;

/** Kyiv wall-clock Y/M/D/H/M for a UTC instant, read via Intl — never a hardcoded offset. */
function kyivParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: KYIV_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/**
 * UTC instant for a given Kyiv wall-clock date+time. Evaluates the Kyiv/UTC
 * offset at the instant itself (via a first-pass guess), so this stays
 * correct across the DST boundary without ever hardcoding +2/+3.
 */
function kyivWallClockToUtc(year, month, day, hour, minute) {
  const guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const kyivAtGuess = kyivParts(new Date(guessUtcMs));
  const kyivAtGuessMs = Date.UTC(
    kyivAtGuess.year,
    kyivAtGuess.month - 1,
    kyivAtGuess.day,
    kyivAtGuess.hour,
    kyivAtGuess.minute,
    kyivAtGuess.second,
  );
  const offsetMs = kyivAtGuessMs - guessUtcMs;
  return new Date(guessUtcMs - offsetMs);
}

/** Pure calendar-day increment on a Y/M/D triple — no zone involved. */
function nextCalendarDay(year, month, day) {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function officeWindowUtc(year, month, day) {
  return {
    open: kyivWallClockToUtc(year, month, day, OFFICE_OPEN_HOUR, 0),
    close: kyivWallClockToUtc(year, month, day, OFFICE_CLOSE_HOUR, 0),
  };
}

function ceilToSlotBoundary(date) {
  const slotMs = SLOT_MINUTES * 60_000;
  return new Date(Math.ceil(date.getTime() / slotMs) * slotMs);
}

/** Half-open interval overlap, mirroring packages/core's `overlaps`. */
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

async function parseJsonSafely(response) {
  const text = await response.text();
  try {
    return text.length > 0 ? JSON.parse(text) : null;
  } catch {
    return text; // non-JSON body (unexpected, but printed as-is rather than swallowed)
  }
}

function authHeaders(cookie, extra = {}) {
  return { Cookie: cookie, ...extra };
}

/** Parses the `session` cookie's name=value pair out of Set-Cookie, discarding attributes. */
function extractSessionCookie(response) {
  const rawCookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : (response.headers.get('set-cookie') ?? '').split(/,(?=[^;]+?=)/); // fallback for older fetch impls
  for (const raw of rawCookies) {
    const pair = raw.split(';')[0]?.trim();
    if (pair?.startsWith('session=')) return pair;
  }
  return null;
}

async function registerOrLogin() {
  const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: USER_NAME, email: USER_EMAIL, password: USER_PASSWORD }),
  });

  if (registerResponse.status === 201) {
    const cookie = extractSessionCookie(registerResponse);
    if (!cookie) throw new Error('Registered but no session cookie was set');
    return cookie;
  }

  if (registerResponse.status !== 409) {
    throw new Error(`Unexpected register status ${registerResponse.status}: ${JSON.stringify(await parseJsonSafely(registerResponse))}`);
  }

  // Already registered by a previous run — fall back to logging in.
  const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD }),
  });
  if (loginResponse.status !== 200) {
    throw new Error(`Login fallback failed with status ${loginResponse.status}: ${JSON.stringify(await parseJsonSafely(loginResponse))}`);
  }
  const cookie = extractSessionCookie(loginResponse);
  if (!cookie) throw new Error('Logged in but no session cookie was set');
  return cookie;
}

async function pickRoom(cookie) {
  const response = await fetch(`${BASE_URL}/api/rooms`, { headers: authHeaders(cookie) });
  if (response.status !== 200) {
    throw new Error(`GET /api/rooms failed with status ${response.status}`);
  }
  const body = await parseJsonSafely(response);
  const rooms = Array.isArray(body) ? body : (body?.rooms ?? []);
  if (rooms.length === 0) throw new Error('No rooms returned by GET /api/rooms — did the seed run?');
  return rooms[0]; // first of the six seeded rooms; deterministic across runs
}

async function fetchRoomBookings(cookie, roomId, from, to) {
  const url = `${BASE_URL}/api/rooms/${roomId}/bookings?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
  const response = await fetch(url, { headers: authHeaders(cookie) });
  if (response.status !== 200) {
    throw new Error(`GET /api/rooms/${roomId}/bookings failed with status ${response.status}`);
  }
  const body = await parseJsonSafely(response);
  return Array.isArray(body) ? body : (body?.bookings ?? []);
}

/**
 * Walks forward from "now + buffer" until it finds a 1-hour, 30-min-aligned
 * slot inside Kyiv office hours that doesn't overlap any live booking already
 * on the room — so a rerun never collides with a previous run's booking.
 */
async function findFreeSlot(cookie, roomId) {
  const earliest = ceilToSlotBoundary(new Date(Date.now() + FUTURE_BUFFER_MINUTES * 60_000));
  let { year, month, day } = kyivParts(earliest);

  for (let daysChecked = 0; daysChecked < MAX_DAYS_AHEAD; daysChecked += 1) {
    const { open, close } = officeWindowUtc(year, month, day);
    const existing = await fetchRoomBookings(cookie, roomId, open, close);
    const busy = existing.map((b) => [new Date(b.startsAt), new Date(b.endsAt)]);

    let candidate = daysChecked === 0 && earliest > open ? earliest : open;
    while (candidate.getTime() + BOOKING_MINUTES * 60_000 <= close.getTime()) {
      const candidateEnd = new Date(candidate.getTime() + BOOKING_MINUTES * 60_000);
      const collides = busy.some(([bStart, bEnd]) => intervalsOverlap(candidate, candidateEnd, bStart, bEnd));
      if (!collides) return { start: candidate, end: candidateEnd, dayOpen: open, dayClose: close };
      candidate = new Date(candidate.getTime() + SLOT_MINUTES * 60_000);
    }

    ({ year, month, day } = nextCalendarDay(year, month, day));
  }

  throw new Error(`No free slot found in room ${roomId} within ${MAX_DAYS_AHEAD} days`);
}

async function postBooking(cookie, roomId, start, end) {
  const response = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: authHeaders(cookie, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      roomId,
      title: BOOKING_TITLE,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    }),
  });
  return { status: response.status, body: await parseJsonSafely(response) };
}

async function main() {
  const cookie = await registerOrLogin();
  const room = await pickRoom(cookie);
  const slot = await findFreeSlot(cookie, room.id);

  console.log(`Room: ${room.name} (id ${room.id})`);
  console.log(`Slot (UTC): ${slot.start.toISOString()} -> ${slot.end.toISOString()}`);
  console.log(`Title: ${BOOKING_TITLE}`);
  console.log('Firing two identical POST /api/bookings concurrently...\n');

  const [first, second] = await Promise.all([
    postBooking(cookie, room.id, slot.start, slot.end),
    postBooking(cookie, room.id, slot.start, slot.end),
  ]);

  console.log(`Response A: ${first.status} ${JSON.stringify(first.body)}`);
  console.log(`Response B: ${second.status} ${JSON.stringify(second.body)}\n`);

  const statuses = [first.status, second.status];
  const created = statuses.filter((s) => s === 201).length;
  const conflicted = statuses.filter((s) => s === 409).length;

  const rows = await fetchRoomBookings(cookie, room.id, slot.dayOpen, slot.dayClose);
  const matching = rows.filter((b) => b.title === BOOKING_TITLE);

  console.log(`201 responses: ${created}`);
  console.log(`409 responses: ${conflicted}`);
  console.log(`Rows in DB matching "${BOOKING_TITLE}": ${matching.length}`);

  const pass = created === 1 && conflicted === 1 && matching.length === 1;

  if (pass) {
    console.log('\nPASS: the EXCLUDE constraint let exactly one of the two identical requests win.');
  } else {
    console.log('\nFAIL: expected exactly one 201, one 409, and one row — the overlap guard did not hold.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('FAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
