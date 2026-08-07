import type { CreateBookingInput, PublicUser } from '@booking/core';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import {
  BookingsRepository,
  RoomNotFoundError,
  SlotTakenError,
  type BookingRow,
  type NewBooking,
  type OwnedBookingRow,
} from './bookings.repository';

const USER: PublicUser = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Іван',
  email: 'ivan@x.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
};
const UNVERIFIED_USER: PublicUser = { ...USER, emailVerifiedAt: null };
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const BOOKING_ID = '33333333-3333-4333-8333-333333333333';

// Tuesday 09:00 Kyiv (winter, +2) — itself a valid, aligned, in-hours instant,
// so it doubles as "now" without any other rule tripping first.
const NOW = new Date('2026-01-06T07:00:00Z');

// Wednesday 09:00-10:00 Kyiv: aligned, 60 minutes, in office hours, after NOW.
const VALID_INPUT: CreateBookingInput = {
  roomId: 3,
  title: 'Синк по Q4',
  startsAt: new Date('2026-01-07T07:00:00Z'),
  endsAt: new Date('2026-01-07T08:00:00Z'),
};

const VALID_ROW: BookingRow = {
  id: BOOKING_ID,
  roomId: VALID_INPUT.roomId,
  title: VALID_INPUT.title,
  startsAt: VALID_INPUT.startsAt,
  endsAt: VALID_INPUT.endsAt,
  userId: USER.id,
  userName: USER.name,
  seriesId: null,
};

type MockedRepository = { [K in keyof BookingsRepository]: jest.Mock };

function createRepository(): MockedRepository {
  return {
    createBooking: jest.fn(async () => VALID_ROW),
    findBookingById: jest.fn(async () => null),
    cancelBooking: jest.fn(async () => undefined),
    listRoomBookings: jest.fn(async () => []),
    listMyBookings: jest.fn(async () => ({ bookings: [], total: 0, page: 1, limit: 10, hasMore: false })),
    createBookingSeries: jest.fn(async () => ({ id: 'series-id' })),
    deleteBookingSeries: jest.fn(async () => undefined),
    findBookingOwnershipAndSeries: jest.fn(async () => null),
    cancelBookingSeries: jest.fn(async () => undefined),
  };
}

function createService(repository: MockedRepository): BookingsService {
  return new BookingsService(repository as unknown as BookingsRepository);
}

function bodyOf(error: unknown): unknown {
  return (error as ConflictException).getResponse();
}

// A fixed "now" is injected by mocking Date so the service's own `new Date()`
// call lines up with NOW without threading a clock through the constructor.
function useFixedNow(): void {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(NOW);
}

describe('BookingsService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('create', () => {
    it('returns 403 Forbidden with email verification message for unverified user (emailVerifiedAt: null)', async () => {
      useFixedNow();
      const repository = createRepository();

      const error = await createService(repository)
        .create(UNVERIFIED_USER, VALID_INPUT)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(bodyOf(error)).toEqual({
        statusCode: 403,
        message: 'Для створення бронювання необхідно підтвердити пошту',
      });
      expect(repository.createBooking).not.toHaveBeenCalled();
    });

    it('succeeds for a verified user (emailVerifiedAt: "2026-01-01T00:00:00.000Z")', async () => {
      useFixedNow();
      const repository = createRepository();
      const verifiedUser: PublicUser = { ...USER, emailVerifiedAt: '2026-01-01T00:00:00.000Z' };

      const result = await createService(repository).create(verifiedUser, VALID_INPUT);

      expect(result).toEqual(VALID_ROW);
      expect(repository.createBooking).toHaveBeenCalled();
    });

    it('returns the created row for a valid, well-formed booking', async () => {
      useFixedNow();
      const repository = createRepository();

      const result = await createService(repository).create(USER, VALID_INPUT);

      expect(result).toEqual(VALID_ROW);
      const [insert] = repository.createBooking.mock.calls[0] as [NewBooking];
      expect(insert).toEqual({
        roomId: VALID_INPUT.roomId,
        userId: USER.id,
        userName: USER.name,
        title: VALID_INPUT.title,
        startsAt: VALID_INPUT.startsAt,
        endsAt: VALID_INPUT.endsAt,
      });
    });

    it('rejects misaligned times with a 400 under startsAt', async () => {
      useFixedNow();
      const repository = createRepository();

      const error = await createService(repository)
        .create(USER, { ...VALID_INPUT, startsAt: new Date('2026-01-07T07:05:00Z'), endsAt: new Date('2026-01-07T07:35:00Z') })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(bodyOf(error)).toEqual({ statusCode: 400, errors: { startsAt: ['Час має бути кратним 30 хвилинам'] } });
      expect(repository.createBooking).not.toHaveBeenCalled();
    });

    it('rejects a booking shorter than the minimum duration with a 400 under startsAt', async () => {
      useFixedNow();
      const repository = createRepository();

      const error = await createService(repository)
        .create(USER, { ...VALID_INPUT, endsAt: VALID_INPUT.startsAt })
        .catch((caught: unknown) => caught);

      expect(bodyOf(error)).toEqual({
        statusCode: 400,
        errors: { startsAt: ['Тривалість має бути від 30 хв до 4 год'] },
      });
      expect(repository.createBooking).not.toHaveBeenCalled();
    });

    it('rejects a booking outside office hours with a 400 under startsAt', async () => {
      useFixedNow();
      const repository = createRepository();

      const error = await createService(repository)
        .create(USER, { ...VALID_INPUT, startsAt: new Date('2026-01-07T18:00:00Z'), endsAt: new Date('2026-01-07T19:00:00Z') })
        .catch((caught: unknown) => caught);

      expect(bodyOf(error)).toEqual({ statusCode: 400, errors: { startsAt: ['Поза робочими годинами'] } });
      expect(repository.createBooking).not.toHaveBeenCalled();
    });

    it('rejects a start time in the past with a 400 under startsAt', async () => {
      useFixedNow();
      const repository = createRepository();

      const error = await createService(repository)
        .create(USER, { ...VALID_INPUT, startsAt: new Date('2026-01-05T07:00:00Z'), endsAt: new Date('2026-01-05T08:00:00Z') })
        .catch((caught: unknown) => caught);

      expect(bodyOf(error)).toEqual({ statusCode: 400, errors: { startsAt: ['Час у минулому'] } });
      expect(repository.createBooking).not.toHaveBeenCalled();
    });

    it('turns a repository SlotTakenError into a 409 with the documented message', async () => {
      useFixedNow();
      const repository = createRepository();
      repository.createBooking.mockRejectedValue(new SlotTakenError());

      const error = await createService(repository).create(USER, VALID_INPUT).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ConflictException);
      expect(bodyOf(error)).toEqual({ statusCode: 409, message: 'Слот зайнятий' });
    });

    it('turns a repository RoomNotFoundError into a 400 field error under roomId', async () => {
      useFixedNow();
      const repository = createRepository();
      repository.createBooking.mockRejectedValue(new RoomNotFoundError());

      const error = await createService(repository).create(USER, VALID_INPUT).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(bodyOf(error)).toEqual({ statusCode: 400, errors: { roomId: ['Обраної кімнати не існує'] } });
    });

    it('rethrows a repository failure that is not a slot conflict', async () => {
      useFixedNow();
      const repository = createRepository();
      const unrelated = new Error('boom');
      repository.createBooking.mockRejectedValue(unrelated);

      await expect(createService(repository).create(USER, VALID_INPUT)).rejects.toBe(unrelated);
    });
  });

  describe('cancel', () => {
    it('throws 404 when the booking does not exist', async () => {
      const repository = createRepository();

      const error = await createService(repository).cancel(USER, BOOKING_ID).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundException);
      expect(bodyOf(error)).toEqual({ statusCode: 404, message: 'Бронювання не знайдено' });
      expect(repository.cancelBooking).not.toHaveBeenCalled();
    });

    it('throws 403 for someone else\'s booking even when it is already cancelled — ownership is checked first', async () => {
      const repository = createRepository();
      const alreadyCanceledOthers: OwnedBookingRow = { id: BOOKING_ID, userId: OTHER_USER_ID, canceledAt: new Date() };
      repository.findBookingById.mockResolvedValue(alreadyCanceledOthers);

      const error = await createService(repository).cancel(USER, BOOKING_ID).catch((caught: unknown) => caught);

      // 403, not 409: if the already-cancelled check ran first, a stranger could
      // learn the booking's cancellation state before ever proving ownership.
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(bodyOf(error)).toEqual({ statusCode: 403, message: 'Ви не можете скасувати чуже бронювання' });
      expect(repository.cancelBooking).not.toHaveBeenCalled();
    });

    it('throws 403 for a live booking owned by someone else', async () => {
      const repository = createRepository();
      repository.findBookingById.mockResolvedValue({ id: BOOKING_ID, userId: OTHER_USER_ID, canceledAt: null });

      const error = await createService(repository).cancel(USER, BOOKING_ID).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(repository.cancelBooking).not.toHaveBeenCalled();
    });

    it('throws 409 for its own booking that is already cancelled', async () => {
      const repository = createRepository();
      repository.findBookingById.mockResolvedValue({ id: BOOKING_ID, userId: USER.id, canceledAt: new Date() });

      const error = await createService(repository).cancel(USER, BOOKING_ID).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ConflictException);
      expect(bodyOf(error)).toEqual({ statusCode: 409, message: 'Це бронювання вже скасовано' });
      expect(repository.cancelBooking).not.toHaveBeenCalled();
    });

    it('cancels its own live booking', async () => {
      const repository = createRepository();
      repository.findBookingById.mockResolvedValue({ id: BOOKING_ID, userId: USER.id, canceledAt: null });

      await createService(repository).cancel(USER, BOOKING_ID);

      expect(repository.cancelBooking).toHaveBeenCalledWith(BOOKING_ID);
    });
  });

  describe('listForRoom', () => {
    it('delegates straight to the repository', async () => {
      const repository = createRepository();
      const from = new Date('2026-01-05T00:00:00Z');
      const to = new Date('2026-01-12T00:00:00Z');
      repository.listRoomBookings.mockResolvedValue([VALID_ROW]);

      await expect(createService(repository).listForRoom(3, from, to)).resolves.toEqual([VALID_ROW]);
      expect(repository.listRoomBookings).toHaveBeenCalledWith(3, from, to);
    });
  });

  describe('listMine', () => {
    it('delegates straight to the repository', async () => {
      const repository = createRepository();
      const paginatedResult = { bookings: [], total: 0, page: 1, limit: 10, hasMore: false };
      repository.listMyBookings.mockResolvedValue(paginatedResult);

      const query = { status: 'upcoming' as const, page: 1, limit: 10 };
      const result = await createService(repository).listMine(USER, query);

      expect(result).toEqual(paginatedResult);
      expect(repository.listMyBookings).toHaveBeenCalledWith(USER.id, 'upcoming', 1, 10);
    });
  });
});
