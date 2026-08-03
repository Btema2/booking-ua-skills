import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { BookingsRepository, type BookingRow } from './bookings.repository';
import { BookingsService } from './bookings.service';
import { RoomBookingsController } from './room-bookings.controller';

const SESSION_ID = 'valid-session-id';
const USER = { id: 'user-1', name: 'Іван', email: 'ivan@x.com', emailVerifiedAt: null };

const ROWS: BookingRow[] = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    roomId: 3,
    title: 'Синк по Q4',
    startsAt: new Date('2027-01-06T07:00:00.000Z'),
    endsAt: new Date('2027-01-06T08:00:00.000Z'),
    userId: 'user-1',
    userName: 'Іван',
  },
];

/**
 * Records what the controller asked for. Filtering and joining are SQL
 * concerns covered by the Drizzle repository spec; what matters here is that
 * the parsed room id and range actually reach the persistence boundary.
 */
class RecordingBookingsRepository extends BookingsRepository {
  readonly calls: [number, Date, Date][] = [];

  async createBooking(): Promise<BookingRow> {
    throw new Error('not used in this spec');
  }

  async findBookingById() {
    return null;
  }

  async cancelBooking(): Promise<void> {}

  async listRoomBookings(roomId: number, from: Date, to: Date): Promise<BookingRow[]> {
    this.calls.push([roomId, from, to]);
    return ROWS;
  }
}

const authServiceDouble = {
  resolveSession: async (sessionId: string) => {
    if (sessionId !== SESSION_ID) {
      throw new Error('unexpected session');
    }
    return USER;
  },
};

describe('GET /api/rooms/:roomId/bookings', () => {
  let app: INestApplication;
  let repository: RecordingBookingsRepository;

  beforeEach(async () => {
    repository = new RecordingBookingsRepository();
    const moduleRef = await Test.createTestingModule({
      controllers: [RoomBookingsController],
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
    await app.close();
  });

  const signedIn = (path: string) => request(app.getHttpServer()).get(path).set('Cookie', `${SESSION_COOKIE_NAME}=${SESSION_ID}`);

  it('returns the bookings under a `bookings` key', async () => {
    const response = await signedIn('/api/rooms/3/bookings?from=2027-01-04T00:00:00.000Z&to=2027-01-11T00:00:00.000Z').expect(
      200,
    );

    expect(response.body).toEqual({ bookings: JSON.parse(JSON.stringify(ROWS)) });
  });

  it('coerces the room id and parses from/to into Dates before reaching the repository', async () => {
    await signedIn('/api/rooms/3/bookings?from=2027-01-04T00:00:00.000Z&to=2027-01-11T00:00:00.000Z').expect(200);

    expect(repository.calls).toEqual([[3, new Date('2027-01-04T00:00:00.000Z'), new Date('2027-01-11T00:00:00.000Z')]]);
  });

  it('rejects a missing `from`/`to` with a per-field 400', async () => {
    const response = await signedIn('/api/rooms/3/bookings').expect(400);

    expect(response.body.errors.from).toBeDefined();
    expect(response.body.errors.to).toBeDefined();
    expect(repository.calls).toEqual([]);
  });

  it('rejects a non-date `from` with a per-field 400', async () => {
    const response = await signedIn('/api/rooms/3/bookings?from=not-a-date&to=2027-01-11T00:00:00.000Z').expect(400);

    expect(response.body.errors.from).toBeDefined();
    expect(repository.calls).toEqual([]);
  });

  it('rejects `to` at or before `from`', async () => {
    const response = await signedIn('/api/rooms/3/bookings?from=2027-01-11T00:00:00.000Z&to=2027-01-04T00:00:00.000Z').expect(
      400,
    );

    expect(response.body.errors.to).toBeDefined();
    expect(repository.calls).toEqual([]);
  });

  it('rejects a non-numeric room id with a 400', async () => {
    const response = await signedIn('/api/rooms/abc/bookings?from=2027-01-04T00:00:00.000Z&to=2027-01-11T00:00:00.000Z').expect(
      400,
    );

    expect(response.body.errors.roomId).toBeDefined();
    expect(repository.calls).toEqual([]);
  });

  it('requires a session', async () => {
    await request(app.getHttpServer())
      .get('/api/rooms/3/bookings?from=2027-01-04T00:00:00.000Z&to=2027-01-11T00:00:00.000Z')
      .expect(401);

    expect(repository.calls).toEqual([]);
  });
});
