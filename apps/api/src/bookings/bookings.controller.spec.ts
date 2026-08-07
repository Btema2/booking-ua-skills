import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { BookingsController } from './bookings.controller';
import {
  BookingsRepository,
  RoomNotFoundError,
  SlotTakenError,
  type BookingRow,
  type MyBookingRow,
  type NewBooking,
  type OwnedBookingRow,
  type PaginatedMyBookings,
} from './bookings.repository';
import { BookingsService } from './bookings.service';

const SESSION_ID = 'valid-session-id';
const USER = { id: '11111111-1111-4111-8111-111111111111', name: 'Іван', email: 'ivan@x.com', emailVerifiedAt: '2026-01-01T00:00:00.000Z' };
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';

// Wednesday 09:00-10:00 Kyiv (winter, +2). This suite runs the *real*
// BookingsService, which calls `new Date()` to reject past instants — so a
// body fixed to one instant only stays valid as long as the wall clock
// hasn't passed it yet. Fake timers pin "now" to a fixed point before it
// (mirrors bookings.service.spec.ts), so the suite can never rot no matter
// how far the real clock moves on.
const NOW = new Date('2026-01-06T07:00:00.000Z');
const VALID_BODY = {
  roomId: 3,
  title: 'Синк по Q4',
  startsAt: '2027-01-06T07:00:00.000Z',
  endsAt: '2027-01-06T08:00:00.000Z',
};

/** Stands in for Postgres: enough state to exercise ownership and cancellation. */
class RecordingBookingsRepository extends BookingsRepository {
  private readonly byId = new Map<string, MyBookingRow & { canceledAt: Date | null; seriesId: string | null }>();
  rejectNextCreateWithSlotTaken = false;
  rejectNextCreateWithRoomNotFound = false;

  async createBooking(input: NewBooking): Promise<BookingRow> {
    if (this.rejectNextCreateWithSlotTaken) {
      throw new SlotTakenError();
    }
    if (this.rejectNextCreateWithRoomNotFound) {
      throw new RoomNotFoundError();
    }
    const row: MyBookingRow & { canceledAt: Date | null; seriesId: string | null } = {
      id: randomUUID(),
      roomId: input.roomId,
      roomName: `Room ${input.roomId}`,
      roomFloor: 1,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      userId: input.userId,
      userName: input.userName,
      canceledAt: null,
      seriesId: input.seriesId ?? null,
    };
    this.byId.set(row.id, row);
    const { roomName, roomFloor, canceledAt, ...bookingRow } = row;
    return bookingRow;
  }

  async findBookingById(id: string): Promise<OwnedBookingRow | null> {
    const found = this.byId.get(id);
    return found ? { id: found.id, userId: found.userId, canceledAt: found.canceledAt } : null;
  }

  async cancelBooking(id: string): Promise<void> {
    const found = this.byId.get(id);
    if (found) {
      found.canceledAt = new Date();
    }
  }

  async listMyBookings(
    userId: string,
    status: 'upcoming' | 'past',
    page: number,
    limit: number,
  ): Promise<PaginatedMyBookings> {
    const userBookings = Array.from(this.byId.values()).filter(
      (b) => b.userId === userId && b.canceledAt === null,
    );

    const filtered = userBookings.filter((b) =>
      status === 'upcoming' ? b.endsAt > NOW : b.endsAt <= NOW,
    );

    filtered.sort((a, b) =>
      status === 'upcoming'
        ? a.startsAt.getTime() - b.startsAt.getTime()
        : b.startsAt.getTime() - a.startsAt.getTime(),
    );

    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    const bookings = paginated.map(({ canceledAt, ...rest }) => rest);

    return {
      bookings,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  async listRoomBookings(): Promise<BookingRow[]> {
    return Array.from(this.byId.values()).map(
      ({ roomName, roomFloor, canceledAt, ...rest }) => rest,
    );
  }

  seed(
    row: Partial<MyBookingRow> & { id: string; userId: string; canceledAt: Date | null; seriesId?: string | null },
  ): void {
    const fullRow: MyBookingRow & { canceledAt: Date | null; seriesId: string | null } = {
      id: row.id,
      roomId: row.roomId ?? 1,
      roomName: row.roomName ?? 'Переговорка 1',
      roomFloor: row.roomFloor ?? 2,
      title: row.title ?? 'Seed',
      startsAt: row.startsAt ?? new Date(),
      endsAt: row.endsAt ?? new Date(),
      userId: row.userId,
      userName: row.userName ?? 'Seed',
      canceledAt: row.canceledAt,
      seriesId: row.seriesId ?? null,
    };
    this.byId.set(row.id, fullRow);
  }

  async createBookingSeries(): Promise<{ id: string }> {
    throw new Error('not implemented in test');
  }

  async deleteBookingSeries(): Promise<void> {
    throw new Error('not implemented in test');
  }

  async findBookingOwnershipAndSeries(): Promise<any> {
    throw new Error('not implemented in test');
  }

  async cancelBookingSeries(): Promise<void> {
    throw new Error('not implemented in test');
  }
}

/** Accepts exactly one session id, mirroring rooms.controller.spec.ts. */
const authServiceDouble = {
  resolveSession: async (sessionId: string) => {
    if (sessionId !== SESSION_ID) {
      throw new Error('unexpected session');
    }
    return USER;
  },
};

describe('BookingsController', () => {
  let app: INestApplication;
  let repository: RecordingBookingsRepository;

  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(NOW);
    repository = new RecordingBookingsRepository();
    const moduleRef = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        AuthGuard,
        BookingsService,
        { provide: BookingsRepository, useValue: repository },
        { provide: AuthService, useValue: authServiceDouble },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterEach(async () => {
    // Real timers restored before closing the app: server teardown may rely
    // on its own timeouts, which a fake clock would otherwise stall.
    jest.useRealTimers();
    await app.close();
  });

  const cookie = `${SESSION_COOKIE_NAME}=${SESSION_ID}`;
  const postBooking = (body: object) => request(app.getHttpServer()).post('/api/bookings').set('Cookie', cookie).send(body);
  const deleteBooking = (id: string) => request(app.getHttpServer()).delete(`/api/bookings/${id}`).set('Cookie', cookie);
  const getMyBookings = (query: string) =>
    request(app.getHttpServer()).get(`/api/bookings/mine?${query}`).set('Cookie', cookie);

  describe('GET /api/bookings/mine', () => {
    it('upcoming status excludes past and cancelled bookings', async () => {
      const upcomingId = randomUUID();
      const pastId = randomUUID();
      const cancelledId = randomUUID();

      repository.seed({
        id: upcomingId,
        userId: USER.id,
        startsAt: new Date('2026-01-07T07:00:00Z'),
        endsAt: new Date('2026-01-07T08:00:00Z'),
        canceledAt: null,
      });

      repository.seed({
        id: pastId,
        userId: USER.id,
        startsAt: new Date('2026-01-05T07:00:00Z'),
        endsAt: new Date('2026-01-05T08:00:00Z'),
        canceledAt: null,
      });

      repository.seed({
        id: cancelledId,
        userId: USER.id,
        startsAt: new Date('2026-01-08T07:00:00Z'),
        endsAt: new Date('2026-01-08T08:00:00Z'),
        canceledAt: new Date('2026-01-05T12:00:00Z'),
      });

      const response = await getMyBookings('status=upcoming').expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.bookings).toHaveLength(1);
      expect(response.body.bookings[0].id).toBe(upcomingId);
    });

    it('past status excludes upcoming and cancelled bookings', async () => {
      const upcomingId = randomUUID();
      const pastId = randomUUID();
      const cancelledId = randomUUID();

      repository.seed({
        id: upcomingId,
        userId: USER.id,
        startsAt: new Date('2026-01-07T07:00:00Z'),
        endsAt: new Date('2026-01-07T08:00:00Z'),
        canceledAt: null,
      });

      repository.seed({
        id: pastId,
        userId: USER.id,
        startsAt: new Date('2026-01-05T07:00:00Z'),
        endsAt: new Date('2026-01-05T08:00:00Z'),
        canceledAt: null,
      });

      repository.seed({
        id: cancelledId,
        userId: USER.id,
        startsAt: new Date('2026-01-04T07:00:00Z'),
        endsAt: new Date('2026-01-04T08:00:00Z'),
        canceledAt: new Date('2026-01-04T09:00:00Z'),
      });

      const response = await getMyBookings('status=past').expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.bookings).toHaveLength(1);
      expect(response.body.bookings[0].id).toBe(pastId);
    });

    it('ordering is correct in both directions (asc for upcoming, desc for past)', async () => {
      const upcomingEarlierId = randomUUID();
      const upcomingLaterId = randomUUID();

      repository.seed({
        id: upcomingLaterId,
        userId: USER.id,
        startsAt: new Date('2026-01-08T07:00:00Z'),
        endsAt: new Date('2026-01-08T08:00:00Z'),
        canceledAt: null,
      });
      repository.seed({
        id: upcomingEarlierId,
        userId: USER.id,
        startsAt: new Date('2026-01-07T07:00:00Z'),
        endsAt: new Date('2026-01-07T08:00:00Z'),
        canceledAt: null,
      });

      const resUpcoming = await getMyBookings('status=upcoming').expect(200);
      expect(resUpcoming.body.bookings.map((b: { id: string }) => b.id)).toEqual([
        upcomingEarlierId,
        upcomingLaterId,
      ]);

      const pastEarlierId = randomUUID();
      const pastLaterId = randomUUID();

      repository.seed({
        id: pastEarlierId,
        userId: USER.id,
        startsAt: new Date('2026-01-04T07:00:00Z'),
        endsAt: new Date('2026-01-04T08:00:00Z'),
        canceledAt: null,
      });
      repository.seed({
        id: pastLaterId,
        userId: USER.id,
        startsAt: new Date('2026-01-05T07:00:00Z'),
        endsAt: new Date('2026-01-05T08:00:00Z'),
        canceledAt: null,
      });

      const resPast = await getMyBookings('status=past').expect(200);
      expect(resPast.body.bookings.map((b: { id: string }) => b.id)).toEqual([
        pastLaterId,
        pastEarlierId,
      ]);
    });

    it('pagination returns the right slice', async () => {
      const id1 = randomUUID();
      const id2 = randomUUID();
      const id3 = randomUUID();

      repository.seed({ id: id1, userId: USER.id, startsAt: new Date('2026-01-07T07:00:00Z'), endsAt: new Date('2026-01-07T08:00:00Z'), canceledAt: null });
      repository.seed({ id: id2, userId: USER.id, startsAt: new Date('2026-01-08T07:00:00Z'), endsAt: new Date('2026-01-08T08:00:00Z'), canceledAt: null });
      repository.seed({ id: id3, userId: USER.id, startsAt: new Date('2026-01-09T07:00:00Z'), endsAt: new Date('2026-01-09T08:00:00Z'), canceledAt: null });

      const page1 = await getMyBookings('status=upcoming&page=1&limit=2').expect(200);
      expect(page1.body).toMatchObject({
        total: 3,
        page: 1,
        limit: 2,
        hasMore: true,
      });
      expect(page1.body.bookings.map((b: { id: string }) => b.id)).toEqual([id1, id2]);

      const page2 = await getMyBookings('status=upcoming&page=2&limit=2').expect(200);
      expect(page2.body).toMatchObject({
        total: 3,
        page: 2,
        limit: 2,
        hasMore: false,
      });
      expect(page2.body.bookings.map((b: { id: string }) => b.id)).toEqual([id3]);
    });

    it("one user cannot see another user's rows", async () => {
      const ownId = randomUUID();
      const othersId = randomUUID();

      repository.seed({ id: ownId, userId: USER.id, startsAt: new Date('2026-01-07T07:00:00Z'), endsAt: new Date('2026-01-07T08:00:00Z'), canceledAt: null });
      repository.seed({ id: othersId, userId: OTHER_USER_ID, startsAt: new Date('2026-01-07T07:00:00Z'), endsAt: new Date('2026-01-07T08:00:00Z'), canceledAt: null });

      const response = await getMyBookings('status=upcoming').expect(200);
      expect(response.body.total).toBe(1);
      expect(response.body.bookings[0].id).toBe(ownId);
    });

    it('requires a session', async () => {
      await request(app.getHttpServer()).get('/api/bookings/mine?status=upcoming').expect(401);
    });

    it('rejects missing or invalid status with 400', async () => {
      await getMyBookings('status=invalid').expect(400);
      await getMyBookings('').expect(400);
    });
  });

  describe('POST /api/bookings', () => {
    it('creates the booking and returns 201 with { booking }', async () => {
      const response = await postBooking(VALID_BODY).expect(201);

      const body = response.body as { booking: BookingRow };
      expect(body.booking).toMatchObject({
        roomId: VALID_BODY.roomId,
        title: VALID_BODY.title,
        userId: USER.id,
        userName: USER.name,
      });
      expect(typeof body.booking.id).toBe('string');
    });

    it('rejects an empty title with a per-field 400', async () => {
      const response = await postBooking({ ...VALID_BODY, title: '' }).expect(400);

      expect(response.body.errors.title).toBeDefined();
    });

    it('rejects a misaligned start time with a 400 under startsAt', async () => {
      const response = await postBooking({ ...VALID_BODY, startsAt: '2027-01-06T07:05:00.000Z' }).expect(400);

      expect(response.body).toEqual({ statusCode: 400, errors: { startsAt: ['Час має бути кратним 30 хвилинам'] } });
    });

    it('turns a taken slot into 409 with the documented message', async () => {
      repository.rejectNextCreateWithSlotTaken = true;

      const response = await postBooking(VALID_BODY).expect(409);

      expect(response.body).toEqual({ statusCode: 409, message: 'Слот зайнятий' });
    });

    it('turns a nonexistent room into a 400 field error under roomId', async () => {
      repository.rejectNextCreateWithRoomNotFound = true;

      const response = await postBooking(VALID_BODY).expect(400);

      expect(response.body).toEqual({ statusCode: 400, errors: { roomId: ['Обраної кімнати не існує'] } });
    });

    it('requires a session', async () => {
      await request(app.getHttpServer()).post('/api/bookings').send(VALID_BODY).expect(401);
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    it('cancels its own booking and returns 204', async () => {
      const created = await postBooking(VALID_BODY).expect(201);
      const { id } = (created.body as { booking: BookingRow }).booking;

      await deleteBooking(id).expect(204);

      await expect(repository.findBookingById(id)).resolves.toMatchObject({ canceledAt: expect.any(Date) });
    });

    it('rejects a non-uuid id with a clean 400, not a 500', async () => {
      const response = await deleteBooking('not-a-uuid').expect(400);

      expect(response.body.errors.id).toBeDefined();
    });

    it('returns 404 for an id that does not exist', async () => {
      await deleteBooking(randomUUID()).expect(404);
    });

    it("returns 403 for someone else's booking, without cancelling it", async () => {
      const othersId = randomUUID();
      repository.seed({ id: othersId, userId: OTHER_USER_ID, canceledAt: null });

      await deleteBooking(othersId).expect(403);

      await expect(repository.findBookingById(othersId)).resolves.toMatchObject({ canceledAt: null });
    });

    it('returns 409 for a booking that is already cancelled', async () => {
      const ownId = randomUUID();
      repository.seed({ id: ownId, userId: USER.id, canceledAt: new Date() });

      await deleteBooking(ownId).expect(409);
    });

    it('requires a session', async () => {
      await request(app.getHttpServer()).delete(`/api/bookings/${randomUUID()}`).expect(401);
    });
  });
});
