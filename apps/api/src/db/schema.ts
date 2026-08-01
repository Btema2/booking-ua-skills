import { sql } from 'drizzle-orm';
import { check, integer, pgTable, serial, text } from 'drizzle-orm/pg-core';

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
