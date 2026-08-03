import type { Room } from '@booking/core';

/**
 * The capacity filter's chips, derived from the rooms that actually exist.
 *
 * A hardcoded ladder («від 4 / 6 / 8 / 12 / 20») goes stale the moment the room
 * table changes: with the seeded set topping out at 16, «від 20» was a chip that
 * could only ever produce the empty state, and «від 4» one that could only ever
 * produce the full list.
 *
 * The rule instead: offer a threshold only where it does real work — at least one
 * room reaches it (so the chip can match) and at least one room falls short (so
 * the chip narrows the list). Every distinct capacity satisfies the first test by
 * construction; the smallest one is the only one that fails the second, which is
 * why it drops out. So the answer is the distinct capacities above the minimum,
 * ascending, and each chip is guaranteed a non-empty result different from «Будь-яка».
 *
 * This is deliberately not the same thing as "hide the chips that return nothing
 * today". The empty state stays reachable — a stale link, a hand-typed
 * `?minCapacity=99`, or a room deleted after the page loaded all still land on it.
 */
export function capacityThresholds(rooms: readonly Room[]): number[] {
  if (rooms.length === 0) {
    return [];
  }
  const smallest = Math.min(...rooms.map((room) => room.capacity));
  const distinct = new Set(rooms.map((room) => room.capacity));
  return [...distinct].filter((capacity) => capacity > smallest).sort((a, b) => a - b);
}
