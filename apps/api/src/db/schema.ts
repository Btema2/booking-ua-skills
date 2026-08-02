import { sql } from 'drizzle-orm';
import { check, integer, pgTable, serial, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const rooms = pgTable(
  'rooms',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    floor: integer('floor').notNull(),
    capacity: integer('capacity').notNull(),
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
