-- Custom SQL migration file, put your code below! --

-- Overlap is enforced here, not in application code: a GiST exclusion
-- constraint rejects a conflicting INSERT/UPDATE atomically, closing the
-- check-then-insert race a naive "SELECT then INSERT" would leave open.
-- `'[)'` makes the range half-open so a booking ending at 10:00 and one
-- starting at 10:00 do not overlap (back-to-back bookings stay legal).
-- `where (canceled_at is null)` excludes soft-deleted rows, so cancelling
-- a booking immediately frees its room/time slot for a new one.
create extension if not exists btree_gist;
--> statement-breakpoint
alter table bookings add constraint bookings_no_overlap
  exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (canceled_at is null);
