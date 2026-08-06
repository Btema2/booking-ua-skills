import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { getConnection, closeConnection } from '../src/db/connection';
import { users } from '../src/db/schema';
import { NotificationsService } from '../src/notifications/notifications.service';
import { setupTestDb, truncateTables } from './test-db-setup';

describe('API Integration Tests (Notifications — end-of-booking reminder)', () => {
  let app: NestExpressApplication;
  let notificationsService: NotificationsService;

  beforeAll(async () => {
    await setupTestDb();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.use(cookieParser());
    await app.init();

    // The real scheduler ticks every 30s on real time — calling the service
    // directly with a controlled `now` is what makes "N minutes before the
    // end" provable without the test actually waiting N minutes.
    notificationsService = moduleRef.get(NotificationsService);
  });

  beforeEach(async () => {
    await truncateTables();
  });

  afterAll(async () => {
    await app.close();
    await closeConnection();
  });

  async function createVerifiedUser(name: string, email: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name, email, password: 'Password123!' });
    expect(res.status).toBe(201);

    const cookie = res.get('Set-Cookie');
    if (!cookie) {
      throw new Error('Register response is missing a Set-Cookie header');
    }
    const user = res.body.user;

    const { db } = getConnection();
    await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));

    return { user, cookie };
  }

  async function createBooking(cookie: string[], title: string, startsAt: string, endsAt: string) {
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send({ roomId: 1, title, startsAt, endsAt });
    expect(res.status).toBe(201);
    return res.body.booking as { id: string };
  }

  // 10:00-11:00 Kyiv (EEST, +3), and its back-to-back neighbour 11:00-12:00.
  const ENDING_STARTS_AT = '2028-06-15T07:00:00.000Z';
  const ENDING_ENDS_AT = '2028-06-15T08:00:00.000Z';
  const NEXT_SLOT_STARTS_AT = '2028-06-15T08:00:00.000Z';
  const NEXT_SLOT_ENDS_AT = '2028-06-15T09:00:00.000Z';
  // 5 minutes before ENDING_ENDS_AT — inside the default NOTIFY_BEFORE_MINUTES=10 window.
  const INSIDE_WINDOW_NOW = new Date('2028-06-15T07:55:00.000Z');

  it('fires exactly once, for the ending booking\'s own author, when the next slot is already taken', async () => {
    const { user: author, cookie: authorCookie } = await createVerifiedUser('Author', 'author1@example.com');
    const { cookie: nextCookie } = await createVerifiedUser('Next Slot Owner', 'next1@example.com');

    const ending = await createBooking(authorCookie, 'Sync ending soon', ENDING_STARTS_AT, ENDING_ENDS_AT);
    await createBooking(nextCookie, 'Back-to-back meeting', NEXT_SLOT_STARTS_AT, NEXT_SLOT_ENDS_AT);

    const created = await notificationsService.tick(INSIDE_WINDOW_NOW);
    expect(created).toBe(1);

    const res = await request(app.getHttpServer()).get('/api/notifications').set('Cookie', authorCookie);
    expect(res.status).toBe(200);
    expect(res.body.notifyBeforeMinutes).toBe(10);
    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.notifications[0]).toMatchObject({
      bookingId: ending.id,
      kind: 'ending_soon',
      bookingTitle: 'Sync ending soon',
      roomName: 'Дуб',
      readAt: null,
    });

    // The next slot's own owner is not who gets notified.
    const otherRes = await request(app.getHttpServer()).get('/api/notifications').set('Cookie', nextCookie);
    expect(otherRes.body.notifications).toHaveLength(0);
    void author;
  });

  it('does not duplicate on a second scheduler pass over the same booking', async () => {
    const { cookie: authorCookie } = await createVerifiedUser('Author', 'author2@example.com');
    const { cookie: nextCookie } = await createVerifiedUser('Next Slot Owner', 'next2@example.com');

    const ending = await createBooking(authorCookie, 'Sync ending soon', ENDING_STARTS_AT, ENDING_ENDS_AT);
    await createBooking(nextCookie, 'Back-to-back meeting', NEXT_SLOT_STARTS_AT, NEXT_SLOT_ENDS_AT);

    const firstPass = await notificationsService.tick(INSIDE_WINDOW_NOW);
    expect(firstPass).toBe(1);

    const secondPass = await notificationsService.tick(INSIDE_WINDOW_NOW);
    expect(secondPass).toBe(0);

    const res = await request(app.getHttpServer()).get('/api/notifications').set('Cookie', authorCookie);
    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.notifications[0].bookingId).toBe(ending.id);
  });

  it('never fires when the next slot is free', async () => {
    const { cookie: authorCookie } = await createVerifiedUser('Author', 'author3@example.com');
    await createBooking(authorCookie, 'Sync with nothing after it', ENDING_STARTS_AT, ENDING_ENDS_AT);

    const created = await notificationsService.tick(INSIDE_WINDOW_NOW);
    expect(created).toBe(0);

    const res = await request(app.getHttpServer()).get('/api/notifications').set('Cookie', authorCookie);
    expect(res.body.notifications).toHaveLength(0);
  });

  it('never fires once the ending booking itself has been cancelled', async () => {
    const { cookie: authorCookie } = await createVerifiedUser('Author', 'author4@example.com');
    const { cookie: nextCookie } = await createVerifiedUser('Next Slot Owner', 'next4@example.com');

    const ending = await createBooking(authorCookie, 'Sync ending soon', ENDING_STARTS_AT, ENDING_ENDS_AT);
    await createBooking(nextCookie, 'Back-to-back meeting', NEXT_SLOT_STARTS_AT, NEXT_SLOT_ENDS_AT);

    const cancelRes = await request(app.getHttpServer())
      .delete(`/api/bookings/${ending.id}`)
      .set('Cookie', authorCookie);
    expect(cancelRes.status).toBe(204);

    const created = await notificationsService.tick(INSIDE_WINDOW_NOW);
    expect(created).toBe(0);

    const res = await request(app.getHttpServer()).get('/api/notifications').set('Cookie', authorCookie);
    expect(res.body.notifications).toHaveLength(0);
  });

  it('never fires once the next-slot booking has been cancelled', async () => {
    const { cookie: authorCookie } = await createVerifiedUser('Author', 'author5@example.com');
    const { cookie: nextCookie } = await createVerifiedUser('Next Slot Owner', 'next5@example.com');

    await createBooking(authorCookie, 'Sync ending soon', ENDING_STARTS_AT, ENDING_ENDS_AT);
    const nextSlot = await createBooking(nextCookie, 'Back-to-back meeting', NEXT_SLOT_STARTS_AT, NEXT_SLOT_ENDS_AT);

    const cancelRes = await request(app.getHttpServer())
      .delete(`/api/bookings/${nextSlot.id}`)
      .set('Cookie', nextCookie);
    expect(cancelRes.status).toBe(204);

    const created = await notificationsService.tick(INSIDE_WINDOW_NOW);
    expect(created).toBe(0);

    const res = await request(app.getHttpServer()).get('/api/notifications').set('Cookie', authorCookie);
    expect(res.body.notifications).toHaveLength(0);
  });

  it('marking a notification read updates it, and a stranger cannot mark it read', async () => {
    const { cookie: authorCookie } = await createVerifiedUser('Author', 'author6@example.com');
    const { cookie: nextCookie } = await createVerifiedUser('Next Slot Owner', 'next6@example.com');
    const { cookie: strangerCookie } = await createVerifiedUser('Stranger', 'stranger6@example.com');

    await createBooking(authorCookie, 'Sync ending soon', ENDING_STARTS_AT, ENDING_ENDS_AT);
    await createBooking(nextCookie, 'Back-to-back meeting', NEXT_SLOT_STARTS_AT, NEXT_SLOT_ENDS_AT);
    await notificationsService.tick(INSIDE_WINDOW_NOW);

    const before = await request(app.getHttpServer()).get('/api/notifications').set('Cookie', authorCookie);
    const notificationId = before.body.notifications[0].id as string;

    const strangerAttempt = await request(app.getHttpServer())
      .post(`/api/notifications/${notificationId}/read`)
      .set('Cookie', strangerCookie);
    expect(strangerAttempt.status).toBe(404);

    const ownAttempt = await request(app.getHttpServer())
      .post(`/api/notifications/${notificationId}/read`)
      .set('Cookie', authorCookie);
    expect(ownAttempt.status).toBe(204);

    const after = await request(app.getHttpServer()).get('/api/notifications').set('Cookie', authorCookie);
    expect(after.body.notifications[0].readAt).not.toBeNull();
  });
});
