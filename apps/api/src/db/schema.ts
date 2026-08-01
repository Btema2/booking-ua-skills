import { pgTable, serial, text, integer } from 'drizzle-orm/pg-core';

export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  floor: integer('floor').notNull(),
  capacity: integer('capacity').notNull(),
});
