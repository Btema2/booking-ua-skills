import { describe, expect, it } from 'vitest';
import { NewRoomSchema, RoomListQuerySchema, RoomSchema } from './room';

describe('RoomSchema', () => {
  it('parses a valid room', () => {
    const room = RoomSchema.parse({ id: 1, name: 'Дуб', floor: 1, capacity: 4, amenities: 'Екран, фліпчарт' });
    expect(room).toEqual({ id: 1, name: 'Дуб', floor: 1, capacity: 4, amenities: 'Екран, фліпчарт' });
  });

  it('accepts a room with no amenities recorded', () => {
    const room = RoomSchema.parse({ id: 1, name: 'Дуб', floor: 1, capacity: 4, amenities: null });
    expect(room.amenities).toBeNull();
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

describe('NewRoomSchema', () => {
  it('parses a room without an id, for validating rows before insert', () => {
    const room = NewRoomSchema.parse({ name: 'Верба', floor: 2, capacity: 4 });
    expect(room).toEqual({ name: 'Верба', floor: 2, capacity: 4, amenities: null });
  });

  it('strips an id field if one is present, since new rows must not supply one', () => {
    const parsed = NewRoomSchema.parse({ id: 1, name: 'Верба', floor: 2, capacity: 4 });
    expect(parsed).not.toHaveProperty('id');
  });

  it('still rejects an invalid capacity', () => {
    expect(() => NewRoomSchema.parse({ name: 'Верба', floor: 2, capacity: 0 })).toThrow();
  });
});

describe('RoomListQuerySchema', () => {
  it('reads minCapacity off a query string, where every value arrives as text', () => {
    expect(RoomListQuerySchema.parse({ minCapacity: '6' })).toEqual({ minCapacity: 6 });
  });

  it('treats a missing minCapacity as no filter', () => {
    expect(RoomListQuerySchema.parse({})).toEqual({ minCapacity: undefined });
  });

  it('treats an empty minCapacity as no filter, since ?minCapacity= is what a cleared input sends', () => {
    expect(RoomListQuerySchema.parse({ minCapacity: '' })).toEqual({ minCapacity: undefined });
  });

  it('rejects a minCapacity that is not a positive integer', () => {
    expect(() => RoomListQuerySchema.parse({ minCapacity: 'abc' })).toThrow();
    expect(() => RoomListQuerySchema.parse({ minCapacity: '0' })).toThrow();
    expect(() => RoomListQuerySchema.parse({ minCapacity: '2.5' })).toThrow();
    expect(() => RoomListQuerySchema.parse({ minCapacity: '-3' })).toThrow();
  });

  it('ignores unrelated query parameters rather than failing the request', () => {
    expect(RoomListQuerySchema.parse({ minCapacity: '4', utm_source: 'x' })).toEqual({ minCapacity: 4 });
  });
});
