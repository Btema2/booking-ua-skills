import { and, gt, isNull, lte } from 'drizzle-orm';
import { bookings, notifications, rooms } from '../db/schema';
import { DrizzleNotificationsRepository } from './drizzle-notifications.repository';

// Same rationale as drizzle-rooms.repository.spec.ts: the service spec's mocked
// repository can never prove the SQL this class actually builds — the WHERE
// conditions, the conflict target, and how a `.returning()` result maps back
// to the boolean the service relies on.
jest.mock('../db/connection', () => ({ getConnection: jest.fn() }));

const { getConnection } = jest.requireMock<{ getConnection: jest.Mock }>('../db/connection');

describe('DrizzleNotificationsRepository', () => {
  afterEach(() => {
    getConnection.mockReset();
  });

  describe('findEndingSoonCandidates', () => {
    it('selects live bookings ending inside (now, now + notifyBeforeMinutes]', async () => {
      const where = jest.fn(() => Promise.resolve([]));
      getConnection.mockReturnValue({ db: { select: () => ({ from: () => ({ where }) }) } });

      const now = new Date('2026-01-05T10:50:00Z');
      await new DrizzleNotificationsRepository().findEndingSoonCandidates(now, 10);

      const windowEnd = new Date('2026-01-05T11:00:00Z');
      expect(where).toHaveBeenCalledWith(
        and(isNull(bookings.canceledAt), gt(bookings.endsAt, now), lte(bookings.endsAt, windowEnd)),
      );
    });
  });

  describe('isNextSlotTaken', () => {
    it('returns true when a live booking starts exactly at the given instant', async () => {
      const limit = jest.fn(() => Promise.resolve([{ id: 'b1' }]));
      const where = jest.fn(() => ({ limit }));
      getConnection.mockReturnValue({ db: { select: () => ({ from: () => ({ where }) }) } });

      await expect(
        new DrizzleNotificationsRepository().isNextSlotTaken(3, new Date('2026-01-05T11:00:00Z')),
      ).resolves.toBe(true);
    });

    it('returns false when no row is found', async () => {
      const limit = jest.fn(() => Promise.resolve([]));
      const where = jest.fn(() => ({ limit }));
      getConnection.mockReturnValue({ db: { select: () => ({ from: () => ({ where }) }) } });

      await expect(
        new DrizzleNotificationsRepository().isNextSlotTaken(3, new Date('2026-01-05T11:00:00Z')),
      ).resolves.toBe(false);
    });
  });

  describe('createIfNotExists', () => {
    it('targets the (booking_id, kind) unique index and returns true on a fresh insert', async () => {
      const returning = jest.fn(() => Promise.resolve([{ id: 'n1' }]));
      const onConflictDoNothing = jest.fn(() => ({ returning }));
      const values = jest.fn(() => ({ onConflictDoNothing }));
      getConnection.mockReturnValue({ db: { insert: () => ({ values }) } });

      const result = await new DrizzleNotificationsRepository().createIfNotExists({
        userId: 'u1',
        bookingId: 'b1',
        kind: 'ending_soon',
      });

      expect(result).toBe(true);
      expect(onConflictDoNothing).toHaveBeenCalledWith({ target: [notifications.bookingId, notifications.kind] });
    });

    it('returns false when the unique index already holds the row', async () => {
      const returning = jest.fn(() => Promise.resolve([]));
      const onConflictDoNothing = jest.fn(() => ({ returning }));
      const values = jest.fn(() => ({ onConflictDoNothing }));
      getConnection.mockReturnValue({ db: { insert: () => ({ values }) } });

      await expect(
        new DrizzleNotificationsRepository().createIfNotExists({ userId: 'u1', bookingId: 'b1', kind: 'ending_soon' }),
      ).resolves.toBe(false);
    });
  });

  describe('markRead', () => {
    it('returns true when a row matching id and userId was updated', async () => {
      const returning = jest.fn(() => Promise.resolve([{ id: 'n1' }]));
      const where = jest.fn(() => ({ returning }));
      const set = jest.fn(() => ({ where }));
      getConnection.mockReturnValue({ db: { update: () => ({ set }) } });

      await expect(new DrizzleNotificationsRepository().markRead('n1', 'u1')).resolves.toBe(true);
    });

    it("returns false when no notification matches that id for that user — never mutates someone else's row", async () => {
      const returning = jest.fn(() => Promise.resolve([]));
      const where = jest.fn(() => ({ returning }));
      const set = jest.fn(() => ({ where }));
      getConnection.mockReturnValue({ db: { update: () => ({ set }) } });

      await expect(new DrizzleNotificationsRepository().markRead('n1', 'u1')).resolves.toBe(false);
    });
  });

  describe('createConflictNotification', () => {
    it('inserts a series_conflict notification with message and null bookingId', async () => {
      const returning = jest.fn(() => Promise.resolve([{ id: 'n1' }]));
      const values = jest.fn(() => ({ returning }));
      getConnection.mockReturnValue({ db: { insert: () => ({ values }) } });

      const repo = new DrizzleNotificationsRepository();
      const result = await repo.createConflictNotification('u1', 'Some dates were skipped due to conflicts');

      expect(result).toBe(true);
      expect(values).toHaveBeenCalledWith({
        userId: 'u1',
        kind: 'series_conflict',
        message: 'Some dates were skipped due to conflicts',
      });
    });
  });

  describe('listForUser', () => {
    it('uses leftJoin for bookings and rooms and selects message', async () => {
      const limit = jest.fn(() => Promise.resolve([]));
      const orderBy = jest.fn(() => ({ limit }));
      const where = jest.fn(() => ({ orderBy }));
      const leftJoin2 = jest.fn(() => ({ where }));
      const leftJoin1 = jest.fn(() => ({ leftJoin: leftJoin2 }));
      const from = jest.fn(() => ({ leftJoin: leftJoin1 }));
      const select = jest.fn(() => ({ from }));

      getConnection.mockReturnValue({ db: { select } });

      const repo = new DrizzleNotificationsRepository();
      await repo.listForUser('u1', 10);

      expect(select).toHaveBeenCalledWith(
        expect.objectContaining({
          id: notifications.id,
          bookingId: notifications.bookingId,
          kind: notifications.kind,
          message: notifications.message,
          createdAt: notifications.createdAt,
          readAt: notifications.readAt,
          bookingTitle: bookings.title,
          bookingEndsAt: bookings.endsAt,
          roomId: rooms.id,
          roomName: rooms.name,
        }),
      );
      expect(from).toHaveBeenCalledWith(notifications);
      expect(leftJoin1).toHaveBeenCalledWith(bookings, expect.anything());
      expect(leftJoin2).toHaveBeenCalledWith(rooms, expect.anything());
    });
  });
});

