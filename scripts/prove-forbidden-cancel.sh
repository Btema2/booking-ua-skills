#!/usr/bin/env bash
set -euo pipefail

# Proves that "cancel someone else's booking -> 403" is enforced by the API
# itself, not by hiding a cancel button in the UI: user B is authenticated as
# themselves (their own cookie jar, their own session) and still gets a 403
# from DELETE /api/bookings/:id when :id belongs to user A. The server-side
# check lives in BookingsService.cancel — a client that never renders a
# cancel button for someone else's row would still be blocked here.

BASE_URL="${BASE_URL:-http://localhost:3000}"

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT
JAR_A="$WORKDIR/cookies-a.txt"
JAR_B="$WORKDIR/cookies-b.txt"
touch "$JAR_A" "$JAR_B"

RUN_ID="$$-$(date +%s)"
EMAIL_A="prove-403-a-${RUN_ID}@example.com"
EMAIL_B="prove-403-b-${RUN_ID}@example.com"
PASSWORD='Prove403Pw!'
TITLE="PROVE-403-${RUN_ID}"

OFFICE_OPEN_MIN=$((9 * 60))
OFFICE_CLOSE_MIN=$((19 * 60))
BOOKING_MINUTES=60
SLOT_SECONDS=$((30 * 60))
BUFFER_SECONDS=$((15 * 60))
MAX_CREATE_ATTEMPTS=5

PASS=true

log() { printf '%s\n' "$*"; }
fail() {
  log "FAIL: $*"
  PASS=false
}

# --- HTTP helper -------------------------------------------------------
# Sets HTTP_STATUS/HTTP_BODY as globals (bash has no multi-value return).
# Cookie persistence is curl's own jar (-b/-c on the same file), not manual
# Set-Cookie parsing -- that manual-parse requirement belongs to the Node
# script; here "two cookie jars" is the literal ask.
request() {
  local jar="$1" method="$2" path="$3" data="${4:-}"
  local raw
  if [[ -n "$data" ]]; then
    raw=$(curl -sS -b "$jar" -c "$jar" -X "$method" "${BASE_URL}${path}" \
      -H 'Content-Type: application/json' -d "$data" -w $'\n%{http_code}')
  else
    raw=$(curl -sS -b "$jar" -c "$jar" -X "$method" "${BASE_URL}${path}" -w $'\n%{http_code}')
  fi
  HTTP_STATUS="${raw##*$'\n'}"
  HTTP_BODY="${raw%$'\n'*}"
}

# --- tiny JSON field readers (no jq dependency) -------------------------
# Matches the first (string|number) occurrence of "field": in a flat or
# one-level-nested body. Safe here because each field name used below
# ("id", "title") only ever appears once per relevant object in this API.
json_string_field() {
  local json="$1" field="$2"
  printf '%s' "$json" \
    | { grep -oE "\"${field}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" || true; } \
    | head -n1 \
    | sed -E "s/.*:[[:space:]]*\"([^\"]*)\"\$/\\1/"
}

json_number_field_last() {
  local json="$1" field="$2"
  printf '%s' "$json" \
    | { grep -oE "\"${field}\"[[:space:]]*:[[:space:]]*-?[0-9]+" || true; } \
    | tail -n1 \
    | sed -E "s/.*:[[:space:]]*(-?[0-9]+)\$/\\1/"
}

# --- Kyiv-aware slot math -------------------------------------------------
# All conversions go through GNU date's real tzdata lookup (TZ=Europe/Kyiv,
# or the embedded `TZ="Zone" ...` syntax) so the +2/+3 offset is whatever it
# actually is for the date in question -- never a literal in this script.
kyiv_minutes_of_day() {
  local epoch="$1" h m
  h=$(TZ=Europe/Kyiv date -d "@${epoch}" +%H)
  m=$(TZ=Europe/Kyiv date -d "@${epoch}" +%M)
  echo $((10#$h * 60 + 10#$m))
}

kyiv_date_of() { TZ=Europe/Kyiv date -d "@$1" +%Y-%m-%d; }

kyiv_wall_clock_to_epoch() {
  # $1 = YYYY-MM-DD, $2 = HH:MM, both meant as Kyiv local time.
  date -d "TZ=\"Europe/Kyiv\" $1 $2:00" +%s
}

next_calendar_date() { date -d "$1 +1 day" +%Y-%m-%d; }

iso_utc() { date -u -d "@$1" +%Y-%m-%dT%H:%M:%SZ; }

# First aligned, future, in-office-hours candidate start (epoch seconds).
# Epoch-aligned to :00/:30 is also Kyiv-aligned: Kyiv's UTC offset is always
# a whole number of hours, so a UTC half-hour boundary is a Kyiv one too.
find_first_candidate() {
  local now_epoch earliest candidate day minutes_of_day
  now_epoch=$(date +%s)
  earliest=$((now_epoch + BUFFER_SECONDS))
  candidate=$(((earliest + SLOT_SECONDS - 1) / SLOT_SECONDS * SLOT_SECONDS))
  day=$(kyiv_date_of "$candidate")
  minutes_of_day=$(kyiv_minutes_of_day "$candidate")

  if ((minutes_of_day < OFFICE_OPEN_MIN)); then
    candidate=$(kyiv_wall_clock_to_epoch "$day" "09:00")
  elif ((minutes_of_day + BOOKING_MINUTES > OFFICE_CLOSE_MIN)); then
    day=$(next_calendar_date "$day")
    candidate=$(kyiv_wall_clock_to_epoch "$day" "09:00")
  fi
  echo "$candidate"
}

# Advances past a busy slot by 30 minutes, rolling to next day's 09:00 if
# that would spill past closing -- only exercised on an unexpected 409 (a
# leftover booking from an earlier failed run), not the normal path.
advance_slot() {
  local candidate=$(($1 + SLOT_SECONDS)) day minutes_of_day
  day=$(kyiv_date_of "$candidate")
  minutes_of_day=$(kyiv_minutes_of_day "$candidate")
  if ((minutes_of_day + BOOKING_MINUTES > OFFICE_CLOSE_MIN)); then
    day=$(next_calendar_date "$day")
    candidate=$(kyiv_wall_clock_to_epoch "$day" "09:00")
  fi
  echo "$candidate"
}

# --- 1. Register A and B --------------------------------------------------
log "Registering user A (${EMAIL_A}) and user B (${EMAIL_B})..."

request "$JAR_A" POST /api/auth/register \
  "$(printf '{"name":"Prover A","email":"%s","password":"%s"}' "$EMAIL_A" "$PASSWORD")"
[[ "$HTTP_STATUS" == "201" ]] || fail "user A registration returned $HTTP_STATUS: $HTTP_BODY"

request "$JAR_B" POST /api/auth/register \
  "$(printf '{"name":"Prover B","email":"%s","password":"%s"}' "$EMAIL_B" "$PASSWORD")"
[[ "$HTTP_STATUS" == "201" ]] || fail "user B registration returned $HTTP_STATUS: $HTTP_BODY"

if [[ "$PASS" != true ]]; then
  log ""
  log "=== SUMMARY: FAIL (setup) ==="
  exit 1
fi

# --- 2. Pick a room (last of the six seeded rooms -- prove-no-overlap.mjs
# uses the first, so the two proof scripts don't reach for the same room if
# ever run back to back) ---------------------------------------------------
request "$JAR_A" GET /api/rooms
room_id=$(json_number_field_last "$HTTP_BODY" "id")
if [[ -z "$room_id" ]]; then
  fail "could not read a room id from GET /api/rooms: $HTTP_BODY"
  log ""
  log "=== SUMMARY: FAIL (setup) ==="
  exit 1
fi
log "Room id: ${room_id}"

# --- 3. A creates a booking on a valid future Kyiv slot -------------------
candidate_epoch=$(find_first_candidate)
create_status=""
create_body=""
attempt=0
while ((attempt < MAX_CREATE_ATTEMPTS)); do
  starts_iso=$(iso_utc "$candidate_epoch")
  ends_iso=$(iso_utc "$((candidate_epoch + BOOKING_MINUTES * 60))")
  request "$JAR_A" POST /api/bookings \
    "$(printf '{"roomId":%s,"title":"%s","startsAt":"%s","endsAt":"%s"}' "$room_id" "$TITLE" "$starts_iso" "$ends_iso")"
  create_status="$HTTP_STATUS"
  create_body="$HTTP_BODY"
  [[ "$create_status" == "201" ]] && break
  if [[ "$create_status" == "409" ]]; then
    attempt=$((attempt + 1))
    log "Slot busy (409) -- likely a leftover from an earlier run; advancing 30 min (attempt ${attempt}/${MAX_CREATE_ATTEMPTS})..."
    candidate_epoch=$(advance_slot "$candidate_epoch")
    continue
  fi
  fail "unexpected status ${create_status} creating A's booking: ${create_body}"
  break
done

if [[ "$create_status" != "201" ]]; then
  fail "could not create A's booking after ${MAX_CREATE_ATTEMPTS} attempts (last status ${create_status})"
  log ""
  log "=== SUMMARY: FAIL (setup) ==="
  exit 1
fi

booking_id=$(json_string_field "$create_body" "id")
if [[ -z "$booking_id" ]]; then
  fail "could not extract booking id from create response: ${create_body}"
  log ""
  log "=== SUMMARY: FAIL (setup) ==="
  exit 1
fi
log "A's booking: id ${booking_id}, ${starts_iso} -> ${ends_iso}"

booking_day=$(kyiv_date_of "$candidate_epoch")
day_open_iso=$(iso_utc "$(kyiv_wall_clock_to_epoch "$booking_day" "09:00")")
day_close_iso=$(iso_utc "$(kyiv_wall_clock_to_epoch "$booking_day" "19:00")")

# --- 4. B (authenticated as themselves) tries to cancel A's booking -------
log ""
log "=== B attempts DELETE /api/bookings/${booking_id} (expect 403) ==="
b_delete_transcript=$(curl -sS -i -b "$JAR_B" -c "$JAR_B" -X DELETE "${BASE_URL}/api/bookings/${booking_id}" | tr -d '\r')
log "$b_delete_transcript"

b_status_line=$(printf '%s\n' "$b_delete_transcript" | { grep -E '^HTTP/' || true; } | tail -n1)
b_status=$(printf '%s' "$b_status_line" | awk '{print $2}')

if [[ "$b_status" == "403" ]]; then
  log "PASS: B got 403 cancelling A's booking."
else
  fail "expected 403 for B's cancel attempt, got '${b_status}'"
fi

# --- 5. Confirm the booking is still live -- nothing was actually cancelled
request "$JAR_A" GET "/api/rooms/${room_id}/bookings?from=${day_open_iso}&to=${day_close_iso}"
if grep -qF "\"title\":\"${TITLE}\"" <<<"$HTTP_BODY"; then
  log "PASS: booking is still live after B's forbidden cancel attempt."
else
  fail "booking is missing after B's forbidden cancel attempt -- the 403 did not actually block it"
fi

# --- 6. A cancels her own booking -- proves the endpoint works, the 403
# above was about authorization and not a broken DELETE route ---------------
log ""
log "=== A cancels her own booking (expect 204) ==="
request "$JAR_A" DELETE "/api/bookings/${booking_id}"
if [[ "$HTTP_STATUS" == "204" ]]; then
  log "PASS: A cancelled her own booking (204)."
else
  fail "expected 204 when A cancels her own booking, got ${HTTP_STATUS}: ${HTTP_BODY}"
fi

log ""
if [[ "$PASS" == true ]]; then
  log "=== SUMMARY: PASS ==="
  exit 0
else
  log "=== SUMMARY: FAIL ==="
  exit 1
fi
