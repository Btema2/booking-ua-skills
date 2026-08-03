import { describe, expect, it } from 'vitest';
import type { Room } from '@booking/core';
import { capacityThresholds } from './capacityThresholds';

const room = (name: string, capacity: number): Room => ({
  id: capacity,
  name,
  floor: 1,
  capacity,
  amenities: null,
});

/** The seeded set, which is also the handoff's room table. */
const SEEDED = [
  room('Дуб', 12),
  room('Ясен', 8),
  room('Липа', 4),
  room('Верба', 6),
  room('Сосна', 16),
  room('Клен', 4),
];

describe('capacityThresholds', () => {
  it('offers one threshold per distinct capacity that some room reaches', () => {
    expect(capacityThresholds(SEEDED)).toEqual([6, 8, 12, 16]);
  });

  it('drops the smallest capacity, which every room already meets', () => {
    // «від 4» would return all six rooms — the same list as no filter at all.
    expect(capacityThresholds(SEEDED)).not.toContain(4);
  });

  it('never offers a threshold no room can satisfy', () => {
    const largest = Math.max(...SEEDED.map((r) => r.capacity));

    for (const threshold of capacityThresholds(SEEDED)) {
      expect(SEEDED.some((r) => r.capacity >= threshold)).toBe(true);
      expect(threshold).toBeLessThanOrEqual(largest);
    }
  });

  it('collapses duplicate capacities to a single threshold', () => {
    expect(capacityThresholds([room('a', 4), room('b', 4), room('c', 9), room('d', 9)])).toEqual([9]);
  });

  it('returns nothing when every room is the same size, since no filter would narrow anything', () => {
    expect(capacityThresholds([room('a', 6), room('b', 6)])).toEqual([]);
  });

  it('returns nothing for a single room', () => {
    expect(capacityThresholds([room('a', 6)])).toEqual([]);
  });

  it('returns nothing for an empty list', () => {
    expect(capacityThresholds([])).toEqual([]);
  });

  it('sorts ascending regardless of the order rooms arrive in', () => {
    expect(capacityThresholds([room('a', 20), room('b', 2), room('c', 11)])).toEqual([11, 20]);
  });
});
