import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, serial, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const rooms = pgTable(
  'rooms',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    floor: integer('floor').notNull(),
    capacity: integer('capacity').notNull(),
    // Short free text, populated by the seed only — never edited through the API.
    amenities: text('amenities'),
  },
  (table) => [check('rooms_capacity_positive', sql`${table.capacity} > 0`)],
);

// `email` is stored already trimmed and lower-cased by EmailSchema, so this
// unique index is what makes `IVAN@x.com` and ` ivan@x.com ` collide.
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_key').on(table.email)],
);

export const sessions = pgTable('sessions', {
  // Opaque 32 random bytes, base64url-encoded in application code.
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Overlap prevention lives in the hand-written `bookings_no_overlap` EXCLUDE
// constraint (drizzle's schema DSL cannot express GiST exclusion constraints),
// applied by a follow-up custom migration, not by anything below.
export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: integer('room_id')
      .notNull()
      .references(() => rooms.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    // Soft delete: cancelling frees the room's slot without losing history.
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('bookings_positive_duration', sql`${table.endsAt} > ${table.startsAt}`),
    check('bookings_title_length', sql`char_length(${table.title}) between 1 and 100`),
    index('bookings_room_starts_at_idx').on(table.roomId, table.startsAt),
  ],
);

// `kind` only ever holds `'ending_soon'` for now (SPEC §1); the unique index on
// (booking_id, kind) is what makes "arrives exactly once" true at the database
// level rather than by trusting the scheduler not to double-fire.
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('notifications_once').on(table.bookingId, table.kind)],
);

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  token: text('token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

