import { RoomSchema, type Room } from '@booking/core';
import { z } from 'zod';
import { ApiError, apiRequest } from '../../lib/api';

const RoomListResponseSchema = z.object({ rooms: z.array(RoomSchema) });

const MALFORMED_RESPONSE_MESSAGE = 'Сервер повернув несподівані дані.';

/** Status 0 is what `lib/api` already uses for "the response never became usable". */
const MALFORMED_RESPONSE_STATUS = 0;

const MIN_CAPACITY_PARAM = 'minCapacity';

function roomsPath(minCapacity: number | undefined): string {
  if (minCapacity === undefined) {
    return '/rooms';
  }
  const query = new URLSearchParams({ [MIN_CAPACITY_PARAM]: String(minCapacity) });
  return `/rooms?${query.toString()}`;
}

/**
 * The wire shape is re-validated here rather than cast: a room missing `capacity`
 * would otherwise render as a blank badge instead of surfacing as an error.
 */
export async function fetchRooms(minCapacity: number | undefined): Promise<Room[]> {
  const body = await apiRequest<unknown>(roomsPath(minCapacity));
  const parsed = RoomListResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(MALFORMED_RESPONSE_STATUS, MALFORMED_RESPONSE_MESSAGE);
  }
  return parsed.data.rooms;
}
