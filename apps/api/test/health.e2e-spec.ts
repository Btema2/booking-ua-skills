import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthRepository } from '../src/auth/auth.repository';
import { SESSION_COOKIE_SECURE } from '../src/auth/session-cookie';
import { PUBLIC_DIR } from '../src/static/public-dir';

describe('Health and routing (e2e)', () => {
  let app: NestExpressApplication;
  let publicDir: string;

  beforeAll(async () => {
    publicDir = mkdtempSync(join(tmpdir(), 'spa-e2e-'));
    writeFileSync(join(publicDir, 'index.html'), '<!doctype html><title>App</title>');

    // Both overrides keep this suite off Postgres and off loadEnv(), which AuthModule's
    // SESSION_COOKIE_SECURE factory would otherwise read from an unset environment.
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthRepository)
      .useValue({})
      .overrideProvider(SESSION_COOKIE_SECURE)
      .useValue(false)
      .overrideProvider(PUBLIC_DIR)
      .useValue(publicDir)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(publicDir, { recursive: true, force: true });
  });

  it('GET /api/health returns ok status as JSON', async () => {
    const response = await request(app.getHttpServer()).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /api/does-not-exist returns JSON 404, not HTML', async () => {
    const response = await request(app.getHttpServer()).get('/api/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.type).toBe('application/json');
  });

  it('GET /rooms/1 falls back to index.html for the SPA', async () => {
    const response = await request(app.getHttpServer()).get('/rooms/1');
    expect(response.status).toBe(200);
    expect(response.text).toContain('<title>App</title>');
  });
});
