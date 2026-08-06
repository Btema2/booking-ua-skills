-- Custom SQL migration file, put your code below! --
CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings (user_id);