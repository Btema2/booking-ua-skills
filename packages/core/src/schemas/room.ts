import { z } from 'zod';

export const RoomSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  floor: z.number().int(),
  capacity: z.number().int().positive(),
});

export type Room = z.infer<typeof RoomSchema>;
