import { z } from 'zod';

export const RoomSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  floor: z.number().int(),
  capacity: z.number().int().positive(),
  // Short free text, seeded only — never user-editable, so no length ceiling here.
  amenities: z.string().min(1).nullable(),
});

export type Room = z.infer<typeof RoomSchema>;

// `amenities` defaults to null so seed rows may omit it entirely.
export const NewRoomSchema = RoomSchema.omit({ id: true }).extend({
  amenities: z.string().min(1).nullable().default(null),
});

export type NewRoom = z.infer<typeof NewRoomSchema>;

/**
 * Query string for `GET /api/rooms`. Every value arrives as text, and a cleared
 * filter input sends `?minCapacity=`, which must mean "no filter" rather than
 * "capacity zero" — hence the empty-string normalisation before coercion.
 */
export const RoomListQuerySchema = z.object({
  minCapacity: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
});

export type RoomListQuery = z.infer<typeof RoomListQuerySchema>;
