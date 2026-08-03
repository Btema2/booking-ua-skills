import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { RoomsController } from './rooms.controller';
import { RoomsRepository, type RoomRow } from './rooms.repository';

const SESSION_ID = 'valid-session-id';

const ROOMS: RoomRow[] = [
  { id: 1, name: 'Дуб', floor: 1, capacity: 4, amenities: 'Екран' },
  { id: 3, name: 'Липа', floor: 2, capacity: 8, amenities: null },
];

/**
 * Records what the controller asked for. Filtering and ordering are SQL concerns
 * covered by the Drizzle repository spec; what matters here is that the parsed
 * query actually reaches the persistence boundary.
 */
class RecordingRoomsRepository extends RoomsRepository {
  readonly calls: (number | undefined)[] = [];

  async listRooms(minCapacity?: number): Promise<RoomRow[]> {
    this.calls.push(minCapacity);
    return ROOMS;
  }
}

/** Accepts exactly one session id, so the guard can be exercised both ways. */
const authServiceDouble = {
  resolveSession: async (sessionId: string) => {
    if (sessionId !== SESSION_ID) {
      throw new Error('unexpected session');
    }
    return { id: 'user-1', name: 'Іван', email: 'ivan@x.com', emailVerifiedAt: null };
  },
};

describe('GET /api/rooms', () => {
  let app: INestApplication;
  let repository: RecordingRoomsRepository;

  beforeEach(async () => {
    repository = new RecordingRoomsRepository();
    const moduleRef = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [
        AuthGuard,
        { provide: RoomsRepository, useValue: repository },
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

  const signedIn = () => request(app.getHttpServer()).get('/api/rooms').set('Cookie', `${SESSION_COOKIE_NAME}=${SESSION_ID}`);

  it('returns the rooms under a `rooms` key, matching the /auth/me envelope', async () => {
    const response = await signedIn().expect(200);

    expect(response.body).toEqual({ rooms: ROOMS });
  });

  it('asks for every room when no filter is given', async () => {
    await signedIn().expect(200);

    expect(repository.calls).toEqual([undefined]);
  });

  it('passes ?minCapacity through as a number', async () => {
    await request(app.getHttpServer())
      .get('/api/rooms?minCapacity=6')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${SESSION_ID}`)
      .expect(200);

    expect(repository.calls).toEqual([6]);
  });

  it('treats a cleared filter (?minCapacity=) as no filter rather than a 400', async () => {
    await request(app.getHttpServer())
      .get('/api/rooms?minCapacity=')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${SESSION_ID}`)
      .expect(200);

    expect(repository.calls).toEqual([undefined]);
  });

  it('rejects a non-numeric minCapacity with a per-field 400', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/rooms?minCapacity=abc')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${SESSION_ID}`)
      .expect(400);

    expect(response.body.errors.minCapacity).toBeDefined();
    expect(repository.calls).toEqual([]);
  });

  it('requires a session', async () => {
    await request(app.getHttpServer()).get('/api/rooms').expect(401);

    expect(repository.calls).toEqual([]);
  });
});
