import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { getConnection, closeConnection } from '../src/db/connection';
import { bookings, bookingSeries, users } from '../src/db/schema';
import { setupTestDb, truncateTables } from './test-db-setup';

describe('API Integration Tests (Bookings & Auth)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    await setupTestDb();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.use(cookieParser());
    await app.init();
  });

  beforeEach(async () => {
    await truncateTables();
  });

  afterAll(async () => {
    await app.close();
    await closeConnection();
  });

  async function createUser(name: string, email: string, verified = true) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name, email, password: 'Password123!' });

    expect(res.status).toBe(201);
    const cookie = res.get('Set-Cookie');
    if (!cookie) {
      throw new Error('Register response is missing a Set-Cookie header');
    }
    const user = res.body.user;

    if (verified) {
      const { db } = getConnection();
      await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
      user.emailVerifiedAt = new Date().toISOString();
    }

    return { user, cookie };
  }

  describe('Creation', () => {
    it('1. A valid booking returns 201 and the row exists in the database', async () => {
      const { cookie } = await createUser('User One', 'user1@example.com');

      const res = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: 'Valid Team Meeting',
          startsAt: '2028-06-15T07:00:00.000Z', // 10:00 Kyiv (EEST)
          endsAt: '2028-06-15T08:00:00.000Z',   // 11:00 Kyiv
        });

      expect(res.status).toBe(201);
      expect(res.body.booking).toBeDefined();
      expect(res.body.booking.title).toBe('Valid Team Meeting');

      const { db } = getConnection();
      const rows = await db.select().from(bookings).where(eq(bookings.id, res.body.booking.id));
      expect(rows.length).toBe(1);
      expect(rows[0].title).toBe('Valid Team Meeting');
    });

    it('2. Back-to-back bookings both return 201 — 10:00–11:00 then 11:00–12:00 Kyiv', async () => {
      const { cookie } = await createUser('User BackToBack', 'b2b@example.com');

      const res1 = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: 'Slot 1',
          startsAt: '2028-06-15T07:00:00.000Z', // 10:00 Kyiv
          endsAt: '2028-06-15T08:00:00.000Z',   // 11:00 Kyiv
        });
      expect(res1.status).toBe(201);

      const res2 = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: 'Slot 2',
          startsAt: '2028-06-15T08:00:00.000Z', // 11:00 Kyiv
          endsAt: '2028-06-15T09:00:00.000Z',   // 12:00 Kyiv
        });
      expect(res2.status).toBe(201);

      const { db } = getConnection();
      const allBookings = await db.select().from(bookings);
      expect(allBookings.length).toBe(2);
    });

    it('3. An overlapping booking returns 409 with the Ukrainian «Слот зайнятий»', async () => {
      const { cookie: cookieA } = await createUser('User A', 'usera@example.com');
      const { cookie: cookieB } = await createUser('User B', 'userb@example.com');

      const res1 = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookieA)
        .send({
          roomId: 1,
          title: 'First Booking',
          startsAt: '2028-06-15T07:00:00.000Z', // 10:00 Kyiv
          endsAt: '2028-06-15T08:00:00.000Z',   // 11:00 Kyiv
        });
      expect(res1.status).toBe(201);

      const res2 = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookieB)
        .send({
          roomId: 1,
          title: 'Overlapping Booking',
          startsAt: '2028-06-15T07:30:00.000Z', // 10:30 Kyiv
          endsAt: '2028-06-15T08:30:00.000Z',   // 11:30 Kyiv
        });

      expect(res2.status).toBe(409);
      expect(res2.body.message).toBe('Слот зайнятий');
    });

    it('4. Two concurrent identical POSTs produce exactly ONE row', async () => {
      const { cookie } = await createUser('User Race', 'race@example.com');

      const payload = {
        roomId: 1,
        title: 'Race Condition Test',
        startsAt: '2028-06-15T07:00:00.000Z', // 10:00 Kyiv
        endsAt: '2028-06-15T08:00:00.000Z',   // 11:00 Kyiv
      };

      const [resA, resB] = await Promise.all([
        request(app.getHttpServer()).post('/api/bookings').set('Cookie', cookie).send(payload),
        request(app.getHttpServer()).post('/api/bookings').set('Cookie', cookie).send(payload),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([201, 409]);

      const conflictRes = resA.status === 409 ? resA : resB;
      expect(conflictRes.body.message).toBe('Слот зайнятий');

      const { db } = getConnection();
      const rows = await db.select().from(bookings).where(eq(bookings.title, 'Race Condition Test'));
      expect(rows.length).toBe(1);
    });
  });

  describe('Rejections (Status & Distinct Messages)', () => {
    it('5. empty title returns 400 Bad Request', async () => {
      const { cookie } = await createUser('Val User', 'val@example.com');

      const res = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: '   ',
          startsAt: '2028-06-15T07:00:00.000Z',
          endsAt: '2028-06-15T08:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors?.title?.[0]).toBe('Назва має містити від 1 до 100 символів');
    });

    it('6. 101-character title returns 400 Bad Request', async () => {
      const { cookie } = await createUser('Val User', 'val2@example.com');

      const res = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: 'a'.repeat(101),
          startsAt: '2028-06-15T07:00:00.000Z',
          endsAt: '2028-06-15T08:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors?.title?.[0]).toBe('Назва має містити від 1 до 100 символів');
    });

    it('7. unaligned start (10:15) returns 400 Bad Request', async () => {
      const { cookie } = await createUser('Val User', 'val3@example.com');

      const res = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: 'Unaligned',
          startsAt: '2028-06-15T07:15:00.000Z', // 10:15 Kyiv
          endsAt: '2028-06-15T08:15:00.000Z',   // 11:15 Kyiv
        });

      expect(res.status).toBe(400);
      expect(res.body.errors?.startsAt?.[0]).toBe('Час має бути кратним 30 хвилинам');
    });

    it('8. duration under 30 minutes returns 400 Bad Request', async () => {
      const { cookie } = await createUser('Val User', 'val4@example.com');

      const res = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: 'Short',
          startsAt: '2028-06-15T07:00:00.000Z', // 10:00 Kyiv
          endsAt: '2028-06-15T07:00:00.000Z',   // 10:00 Kyiv (0 min)
        });

      expect(res.status).toBe(400);
      expect(res.body.errors?.startsAt?.[0]).toBe('Тривалість має бути від 30 хв до 4 год');
    });

    it('9. duration over 4 hours returns 400 Bad Request', async () => {
      const { cookie } = await createUser('Val User', 'val5@example.com');

      const res = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: 'Too Long',
          startsAt: '2028-06-15T07:00:00.000Z', // 10:00 Kyiv
          endsAt: '2028-06-15T12:00:00.000Z',   // 15:00 Kyiv (5 hours)
        });

      expect(res.status).toBe(400);
      expect(res.body.errors?.startsAt?.[0]).toBe('Тривалість має бути від 30 хв до 4 год');
    });

    it('10. outside 09:00–19:00 Kyiv returns 400 Bad Request', async () => {
      const { cookie } = await createUser('Val User', 'val6@example.com');

      const res = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: 'Early Morning',
          startsAt: '2028-06-15T05:00:00.000Z', // 08:00 Kyiv
          endsAt: '2028-06-15T06:30:00.000Z',   // 09:30 Kyiv
        });

      expect(res.status).toBe(400);
      expect(res.body.errors?.startsAt?.[0]).toBe('Поза робочими годинами');
    });

    it('11. start in the past returns 400 Bad Request', async () => {
      const { cookie } = await createUser('Val User', 'val7@example.com');

      const res = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: 'Past Event',
          startsAt: '2020-06-15T07:00:00.000Z',
          endsAt: '2020-06-15T08:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors?.startsAt?.[0]).toBe('Час у минулому');
    });

    it('asserts that rejection messages 5/6, 7, 8/9, 10, and 11 are all distinct', () => {
      const messages = new Set([
        'Назва має містити від 1 до 100 символів', // 5, 6
        'Час має бути кратним 30 хвилинам',       // 7
        'Тривалість має бути від 30 хв до 4 год',  // 8, 9
        'Поза робочими годинами',                   // 10
        'Час у минулому',                         // 11
      ]);
      expect(messages.size).toBe(5);
    });
  });

  describe('Cancellation and Authorization', () => {
    it('12. Cancelling your own booking succeeds and frees the slot — a new booking for the same range then succeeds', async () => {
      const { cookie: cookieA } = await createUser('User CancelSelf', 'cancelself@example.com');
      const { cookie: cookieB } = await createUser('User Rebook', 'rebook@example.com');

      const createRes = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookieA)
        .send({
          roomId: 1,
          title: 'Original Booking',
          startsAt: '2028-06-15T07:00:00.000Z',
          endsAt: '2028-06-15T08:00:00.000Z',
        });
      expect(createRes.status).toBe(201);
      const bookingId = createRes.body.booking.id;

      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/bookings/${bookingId}`)
        .set('Cookie', cookieA);
      expect(deleteRes.status).toBe(204);

      const rebookRes = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookieB)
        .send({
          roomId: 1,
          title: 'Replacement Booking',
          startsAt: '2028-06-15T07:00:00.000Z',
          endsAt: '2028-06-15T08:00:00.000Z',
        });
      expect(rebookRes.status).toBe(201);
    });

    it("13. Cancelling another user's booking returns 403 and the row is still live", async () => {
      const { cookie: cookieOwner } = await createUser('Owner User', 'owner@example.com');
      const { cookie: cookieStranger } = await createUser('Stranger User', 'stranger@example.com');

      const createRes = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookieOwner)
        .send({
          roomId: 1,
          title: 'Protected Booking',
          startsAt: '2028-06-15T07:00:00.000Z',
          endsAt: '2028-06-15T08:00:00.000Z',
        });
      expect(createRes.status).toBe(201);
      const bookingId = createRes.body.booking.id;

      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/bookings/${bookingId}`)
        .set('Cookie', cookieStranger);
      expect(deleteRes.status).toBe(403);
      expect(deleteRes.body.message).toBe('Ви не можете скасувати чуже бронювання');

      const { db } = getConnection();
      const [found] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
      expect(found).toBeDefined();
      expect(found.canceledAt).toBeNull();
    });

    it('14. Cancelling an unknown id returns 404', async () => {
      const { cookie } = await createUser('User 404', 'u404@example.com');

      const res = await request(app.getHttpServer())
        .delete('/api/bookings/00000000-0000-0000-0000-000000000000')
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Бронювання не знайдено');
    });

    it('15. Any booking endpoint without a session cookie returns 401', async () => {
      const postRes = await request(app.getHttpServer())
        .post('/api/bookings')
        .send({
          roomId: 1,
          title: 'No Auth',
          startsAt: '2028-06-15T07:00:00.000Z',
          endsAt: '2028-06-15T08:00:00.000Z',
        });
      expect(postRes.status).toBe(401);

      const deleteRes = await request(app.getHttpServer())
        .delete('/api/bookings/00000000-0000-0000-0000-000000000000');
      expect(deleteRes.status).toBe(401);

      const mineRes = await request(app.getHttpServer()).get('/api/bookings/mine');
      expect(mineRes.status).toBe(401);
    });
  });

  describe('Verification Gate', () => {
    it('16. An unverified user creating a booking gets 403 with the verification message, distinct from the ownership 403', async () => {
      const { cookie: unverifiedCookie } = await createUser('Unverified User', 'unverified@example.com', false);

      const res = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', unverifiedCookie)
        .send({
          roomId: 1,
          title: 'Unverified Attempt',
          startsAt: '2028-06-15T07:00:00.000Z',
          endsAt: '2028-06-15T08:00:00.000Z',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Для створення бронювання необхідно підтвердити пошту');

      const ownership403Message = 'Ви не можете скасувати чуже бронювання';
      expect(res.body.message).not.toBe(ownership403Message);
    });
  });

  describe('Reads', () => {
    it("17. GET /api/rooms/:id/bookings?from=&to= returns only bookings in range, and each carries the author's name", async () => {
      const { cookie } = await createUser('Taras Shevchenko', 'taras@example.com');

      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: 'Morning Meeting',
          startsAt: '2028-06-15T07:00:00.000Z', // 10:00 Kyiv
          endsAt: '2028-06-15T08:00:00.000Z',   // 11:00 Kyiv
        });

      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: 'Afternoon Meeting',
          startsAt: '2028-06-15T11:00:00.000Z', // 14:00 Kyiv
          endsAt: '2028-06-15T12:00:00.000Z',   // 15:00 Kyiv
        });

      const res = await request(app.getHttpServer())
        .get('/api/rooms/1/bookings?from=2028-06-15T06:00:00.000Z&to=2028-06-15T09:00:00.000Z')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      const bookingsList = Array.isArray(res.body) ? res.body : res.body.bookings;
      expect(Array.isArray(bookingsList)).toBe(true);
      expect(bookingsList.length).toBe(1);
      expect(bookingsList[0].title).toBe('Morning Meeting');
      expect(bookingsList[0].userName).toBe('Taras Shevchenko');
    });

    it("18. GET /api/bookings/mine returns only the caller's own rows", async () => {
      const { cookie: cookieUser1 } = await createUser('User Alpha', 'alpha@example.com');
      const { cookie: cookieUser2 } = await createUser('User Beta', 'beta@example.com');

      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookieUser1)
        .send({
          roomId: 1,
          title: 'Alpha Booking',
          startsAt: '2028-06-15T07:00:00.000Z',
          endsAt: '2028-06-15T08:00:00.000Z',
        });

      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', cookieUser2)
        .send({
          roomId: 1,
          title: 'Beta Booking',
          startsAt: '2028-06-15T08:00:00.000Z',
          endsAt: '2028-06-15T09:00:00.000Z',
        });

      const res1 = await request(app.getHttpServer())
        .get('/api/bookings/mine?status=upcoming')
        .set('Cookie', cookieUser1);

      expect(res1.status).toBe(200);
      expect(res1.body.bookings.length).toBe(1);
      expect(res1.body.bookings[0].title).toBe('Alpha Booking');

      const res2 = await request(app.getHttpServer())
        .get('/api/bookings/mine?status=upcoming')
        .set('Cookie', cookieUser2);

      expect(res2.status).toBe(200);
      expect(res2.body.bookings.length).toBe(1);
      expect(res2.body.bookings[0].title).toBe('Beta Booking');
    });
  });

  describe('Weekly recurring bookings (Phase 8.4)', () => {
    it('19. Creating a series with no conflicts inserts one row per occurrence, all sharing one series_id', async () => {
      const { cookie } = await createUser('Series Clean', 'series-clean@example.com');

      const res = await request(app.getHttpServer())
        .post('/api/bookings/series')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: 'Weekly Sync',
          startsAt: '2028-06-16T07:00:00.000Z', // Tuesday 10:00 Kyiv (EEST)
          endsAt: '2028-06-16T08:00:00.000Z',
          occurrenceCount: 3,
        });

      expect(res.status).toBe(201);
      expect(res.body.created).toHaveLength(3);
      expect(res.body.skipped).toEqual([]);

      const { db } = getConnection();
      const rows = await db.select().from(bookings).where(eq(bookings.seriesId, res.body.series.id));
      expect(rows.length).toBe(3);
      expect(rows.every((r) => r.seriesId === res.body.series.id)).toBe(true);

      const [seriesRow] = await db.select().from(bookingSeries).where(eq(bookingSeries.id, res.body.series.id));
      expect(seriesRow).toBeDefined();
    });

    it('20. Creating a series that partially conflicts creates only the non-conflicting occurrences and reports the rest as skipped', async () => {
      const { cookie: existingCookie } = await createUser('Series Blocker', 'series-blocker@example.com');
      const { cookie: seriesCookie } = await createUser('Series Partial', 'series-partial@example.com');

      // Occupies what would otherwise be occurrence 2 of the series below
      // (Tuesday 2028-06-23, 10:00-11:00 Kyiv).
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', existingCookie)
        .send({
          roomId: 1,
          title: 'Pre-existing block',
          startsAt: '2028-06-23T07:00:00.000Z',
          endsAt: '2028-06-23T08:00:00.000Z',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/bookings/series')
        .set('Cookie', seriesCookie)
        .send({
          roomId: 1,
          title: 'Weekly Sync Partial',
          startsAt: '2028-06-16T07:00:00.000Z',
          endsAt: '2028-06-16T08:00:00.000Z',
          occurrenceCount: 3,
        });

      expect(res.status).toBe(201);
      expect(res.body.created).toHaveLength(2);
      expect(res.body.skipped).toHaveLength(1);

      const { db } = getConnection();
      const rows = await db.select().from(bookings).where(eq(bookings.seriesId, res.body.series.id));
      expect(rows.length).toBe(2);
    });

    it('21. Creating a series where every occurrence conflicts returns 409 and leaves no booking_series row behind', async () => {
      const { cookie: existingCookie } = await createUser('Series AllBlock Owner', 'series-allblock-owner@example.com');
      const { cookie: seriesCookie } = await createUser('Series AllBlock', 'series-allblock@example.com');

      for (const [start, end] of [
        ['2028-06-16T07:00:00.000Z', '2028-06-16T08:00:00.000Z'],
        ['2028-06-23T07:00:00.000Z', '2028-06-23T08:00:00.000Z'],
      ]) {
        await request(app.getHttpServer())
          .post('/api/bookings')
          .set('Cookie', existingCookie)
          .send({ roomId: 1, title: 'Blocker', startsAt: start, endsAt: end })
          .expect(201);
      }

      const beforeCount = (await getConnection().db.select().from(bookingSeries)).length;

      const res = await request(app.getHttpServer())
        .post('/api/bookings/series')
        .set('Cookie', seriesCookie)
        .send({
          roomId: 1,
          title: 'Weekly Sync Blocked',
          startsAt: '2028-06-16T07:00:00.000Z',
          endsAt: '2028-06-16T08:00:00.000Z',
          occurrenceCount: 2,
        });

      expect(res.status).toBe(409);

      const afterCount = (await getConnection().db.select().from(bookingSeries)).length;
      expect(afterCount).toBe(beforeCount);
    });

    it('22. Cancelling one occurrence of a series leaves the rest of the series live', async () => {
      const { cookie } = await createUser('Series CancelOne', 'series-cancelone@example.com');

      const created = await request(app.getHttpServer())
        .post('/api/bookings/series')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: 'Weekly Sync CancelOne',
          startsAt: '2028-06-16T07:00:00.000Z',
          endsAt: '2028-06-16T08:00:00.000Z',
          occurrenceCount: 3,
        })
        .expect(201);

      const firstId = created.body.created[0].id;
      const secondId = created.body.created[1].id;

      await request(app.getHttpServer()).delete(`/api/bookings/${firstId}`).set('Cookie', cookie).expect(204);

      const { db } = getConnection();
      const [firstRow] = await db.select().from(bookings).where(eq(bookings.id, firstId));
      const [secondRow] = await db.select().from(bookings).where(eq(bookings.id, secondId));
      expect(firstRow.canceledAt).not.toBeNull();
      expect(secondRow.canceledAt).toBeNull();
    });

    it('23. Cancelling scope=series cancels every remaining occurrence and leaves the booking_series row in place', async () => {
      const { cookie } = await createUser('Series CancelAll', 'series-cancelall@example.com');

      const created = await request(app.getHttpServer())
        .post('/api/bookings/series')
        .set('Cookie', cookie)
        .send({
          roomId: 1,
          title: 'Weekly Sync CancelAll',
          startsAt: '2028-06-16T07:00:00.000Z',
          endsAt: '2028-06-16T08:00:00.000Z',
          occurrenceCount: 3,
        })
        .expect(201);

      const seriesId = created.body.series.id;
      const anyOccurrenceId = created.body.created[0].id;

      await request(app.getHttpServer())
        .delete(`/api/bookings/${anyOccurrenceId}?scope=series`)
        .set('Cookie', cookie)
        .expect(204);

      const { db } = getConnection();
      const rows = await db.select().from(bookings).where(eq(bookings.seriesId, seriesId));
      expect(rows.length).toBe(3);
      expect(rows.every((r) => r.canceledAt !== null)).toBe(true);

      const [seriesRow] = await db.select().from(bookingSeries).where(eq(bookingSeries.id, seriesId));
      expect(seriesRow).toBeDefined();
    });

    it("24. Cancelling scope=series on another user's booking returns 403 and cancels nothing", async () => {
      const { cookie: ownerCookie } = await createUser('Series Owner', 'series-owner-403@example.com');
      const { cookie: strangerCookie } = await createUser('Series Stranger', 'series-stranger-403@example.com');

      const created = await request(app.getHttpServer())
        .post('/api/bookings/series')
        .set('Cookie', ownerCookie)
        .send({
          roomId: 1,
          title: 'Weekly Sync Protected',
          startsAt: '2028-06-16T07:00:00.000Z',
          endsAt: '2028-06-16T08:00:00.000Z',
          occurrenceCount: 2,
        })
        .expect(201);

      const seriesId = created.body.series.id;
      const anyOccurrenceId = created.body.created[0].id;

      await request(app.getHttpServer())
        .delete(`/api/bookings/${anyOccurrenceId}?scope=series`)
        .set('Cookie', strangerCookie)
        .expect(403);

      const { db } = getConnection();
      const rows = await db.select().from(bookings).where(eq(bookings.seriesId, seriesId));
      expect(rows.length).toBe(2);
      expect(rows.every((r) => r.canceledAt === null)).toBe(true);
    });
  });
});
