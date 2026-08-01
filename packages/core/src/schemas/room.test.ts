import { describe, expect, it } from 'vitest';
import { NewRoomSchema, RoomSchema } from './room';

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

describe('NewRoomSchema', () => {
  it('parses a room without an id, for validating rows before insert', () => {
    const room = NewRoomSchema.parse({ name: 'Верба', floor: 2, capacity: 4 });
    expect(room).toEqual({ name: 'Верба', floor: 2, capacity: 4 });
  });

  it('strips an id field if one is present, since new rows must not supply one', () => {
    const parsed = NewRoomSchema.parse({ id: 1, name: 'Верба', floor: 2, capacity: 4 });
    expect(parsed).not.toHaveProperty('id');
  });

  it('still rejects an invalid capacity', () => {
    expect(() => NewRoomSchema.parse({ name: 'Верба', floor: 2, capacity: 0 })).toThrow();
  });
});
