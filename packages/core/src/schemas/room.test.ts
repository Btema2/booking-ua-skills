import { describe, expect, it } from 'vitest';
import { RoomSchema } from './room';

describe('RoomSchema', () => {
  it('parses a valid room', () => {
    const room = RoomSchema.parse({ id: 1, name: 'Дуб', floor: 1, capacity: 4 });
    expect(room).toEqual({ id: 1, name: 'Дуб', floor: 1, capacity: 4 });
  });

  it('rejects an empty name', () => {
    expect(() => RoomSchema.parse({ id: 1, name: '', floor: 1, capacity: 4 })).toThrow();
  });

  it('rejects a non-integer floor', () => {
    expect(() =>
      RoomSchema.parse({ id: 1, name: 'Ясен', floor: 1.5, capacity: 4 }),
    ).toThrow();
  });

  it('rejects zero or negative capacity', () => {
    expect(() =>
      RoomSchema.parse({ id: 1, name: 'Липа', floor: 1, capacity: 0 }),
    ).toThrow();
    expect(() =>
      RoomSchema.parse({ id: 1, name: 'Липа', floor: 1, capacity: -2 }),
    ).toThrow();
  });
});
