import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ENDING_SOON_KIND, NotificationsRepository, type EndingSoonCandidate } from './notifications.repository';

const NOW = new Date('2026-01-05T10:50:00Z');
const ROOM_ID = 3;
const USER_ID = '11111111-1111-4111-8111-111111111111';
const BOOKING_ID = '22222222-2222-4222-8222-222222222222';

// Ends exactly 10 minutes after NOW — inside the default NOTIFY_BEFORE_MINUTES window.
const CANDIDATE: EndingSoonCandidate = {
  id: BOOKING_ID,
  roomId: ROOM_ID,
  userId: USER_ID,
  endsAt: new Date('2026-01-05T11:00:00Z'),
};

type MockedRepository = { [K in keyof NotificationsRepository]: jest.Mock };

function createRepository(): MockedRepository {
  return {
    findEndingSoonCandidates: jest.fn(async () => [] as EndingSoonCandidate[]),
    isNextSlotTaken: jest.fn(async () => false),
    createIfNotExists: jest.fn(async () => true),
    listForUser: jest.fn(async () => []),
    markRead: jest.fn(async () => true),
  };
}

function createService(repository: MockedRepository): NotificationsService {
  return new NotificationsService(repository as unknown as NotificationsRepository);
}

describe('NotificationsService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NOTIFY_BEFORE_MINUTES: '10' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('tick', () => {
    it('creates a notification when the candidate is inside the window and the next slot is taken', async () => {
      const repository = createRepository();
      repository.findEndingSoonCandidates.mockResolvedValue([CANDIDATE]);
      repository.isNextSlotTaken.mockResolvedValue(true);

      const created = await createService(repository).tick(NOW);

      expect(created).toBe(1);
      expect(repository.findEndingSoonCandidates).toHaveBeenCalledWith(NOW, 10);
      expect(repository.isNextSlotTaken).toHaveBeenCalledWith(ROOM_ID, CANDIDATE.endsAt);
      expect(repository.createIfNotExists).toHaveBeenCalledWith({
        userId: USER_ID,
        bookingId: BOOKING_ID,
        kind: ENDING_SOON_KIND,
      });
    });

    it('does not create a notification when the next slot is free', async () => {
      const repository = createRepository();
      repository.findEndingSoonCandidates.mockResolvedValue([CANDIDATE]);
      repository.isNextSlotTaken.mockResolvedValue(false);

      const created = await createService(repository).tick(NOW);

      expect(created).toBe(0);
      expect(repository.createIfNotExists).not.toHaveBeenCalled();
    });

    it('does not create a notification once the candidate has already ended, even if flagged as a next-slot match', async () => {
      const repository = createRepository();
      const alreadyEnded: EndingSoonCandidate = { ...CANDIDATE, endsAt: new Date('2026-01-05T10:00:00Z') };
      repository.findEndingSoonCandidates.mockResolvedValue([alreadyEnded]);
      repository.isNextSlotTaken.mockResolvedValue(true);

      const created = await createService(repository).tick(NOW);

      expect(created).toBe(0);
      expect(repository.createIfNotExists).not.toHaveBeenCalled();
    });

    it('does not count a second tick over the same booking as a fresh creation once the unique index already holds it', async () => {
      const repository = createRepository();
      repository.findEndingSoonCandidates.mockResolvedValue([CANDIDATE]);
      repository.isNextSlotTaken.mockResolvedValue(true);
      // The Drizzle repository's onConflictDoNothing returns no rows on a repeat insert.
      repository.createIfNotExists.mockResolvedValue(false);

      const created = await createService(repository).tick(NOW);

      expect(created).toBe(0);
      expect(repository.createIfNotExists).toHaveBeenCalledTimes(1);
    });

    it('processes multiple candidates independently', async () => {
      const repository = createRepository();
      const second: EndingSoonCandidate = {
        id: '33333333-3333-4333-8333-333333333333',
        roomId: 4,
        userId: USER_ID,
        endsAt: new Date('2026-01-05T10:55:00Z'),
      };
      repository.findEndingSoonCandidates.mockResolvedValue([CANDIDATE, second]);
      repository.isNextSlotTaken.mockImplementation(async (roomId: number) => roomId === ROOM_ID);

      const created = await createService(repository).tick(NOW);

      expect(created).toBe(1);
      expect(repository.createIfNotExists).toHaveBeenCalledTimes(1);
      expect(repository.createIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({ bookingId: BOOKING_ID }),
      );
    });

    it('reads NOTIFY_BEFORE_MINUTES from the environment on every call', async () => {
      process.env.NOTIFY_BEFORE_MINUTES = '5';
      const repository = createRepository();

      await createService(repository).tick(NOW);

      expect(repository.findEndingSoonCandidates).toHaveBeenCalledWith(NOW, 5);
    });

    it('defaults `now` to the current time when omitted', async () => {
      const repository = createRepository();
      const before = Date.now();

      await createService(repository).tick();

      const [calledNow] = repository.findEndingSoonCandidates.mock.calls[0] as [Date, number];
      expect(calledNow.getTime()).toBeGreaterThanOrEqual(before);
    });
  });

  describe('listMine', () => {
    it('delegates to the repository with the fixed page size and rides NOTIFY_BEFORE_MINUTES along', async () => {
      const repository = createRepository();
      const rows = [{ id: 'n1' }];
      repository.listForUser.mockResolvedValue(rows);

      await expect(createService(repository).listMine(USER_ID)).resolves.toEqual({
        notifications: rows,
        notifyBeforeMinutes: 10,
      });
      expect(repository.listForUser).toHaveBeenCalledWith(USER_ID, 20);
    });

    it('reflects a non-default NOTIFY_BEFORE_MINUTES', async () => {
      process.env.NOTIFY_BEFORE_MINUTES = '15';
      const repository = createRepository();

      const result = await createService(repository).listMine(USER_ID);

      expect(result.notifyBeforeMinutes).toBe(15);
    });
  });

  describe('markRead', () => {
    it('throws 404 when the notification does not belong to the user or does not exist', async () => {
      const repository = createRepository();
      repository.markRead.mockResolvedValue(false);

      const error = await createService(repository)
        .markRead('n1', USER_ID)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toEqual({
        statusCode: 404,
        message: 'Сповіщення не знайдено',
      });
    });

    it('marks it read when it belongs to the user', async () => {
      const repository = createRepository();
      repository.markRead.mockResolvedValue(true);

      await createService(repository).markRead('n1', USER_ID);

      expect(repository.markRead).toHaveBeenCalledWith('n1', USER_ID);
    });
  });
});
