import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Controller, Get, Module } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { AuthController } from './auth/auth.controller';
import { AuthModule } from './auth/auth.module';
import { AuthRepository } from './auth/auth.repository';
import { SESSION_COOKIE_SECURE } from './auth/session-cookie';
import { PUBLIC_DIR } from './static/public-dir';

// Stands in for the rooms/bookings/notifications modules still to come: a feature module
// whose /api routes are registered after the SPA fallback already exists.
@Controller('api/late')
class LateController {
  @Get()
  get(): { ok: true } {
    return { ok: true };
  }
}

@Module({ controllers: [LateController] })
class LateFeatureModule {}

describe('AppModule routing', () => {
  let publicDir: string;
  let app: INestApplication;

  beforeAll(async () => {
    publicDir = mkdtempSync(join(tmpdir(), 'app-module-test-'));
    writeFileSync(join(publicDir, 'index.html'), '<!doctype html><title>App</title>');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule, LateFeatureModule] })
      .overrideProvider(AuthRepository)
      .useValue({})
      .overrideProvider(SESSION_COOKIE_SECURE)
      .useValue(false)
      .overrideProvider(PUBLIC_DIR)
      .useValue(publicDir)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(publicDir, { recursive: true, force: true });
  });

  it('declares AuthController inside AuthModule rather than the root module', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AuthModule)).toContain(AuthController);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AppModule)).not.toContain(AuthController);
  });

  it('answers GET /api/auth/me with a JSON 401 from AuthController', async () => {
    const response = await request(app.getHttpServer()).get('/api/auth/me');
    expect(response.status).toBe(401);
    expect(response.type).toBe('application/json');
  });

  it('answers an unknown /api route with a JSON 404 rather than index.html', async () => {
    const response = await request(app.getHttpServer()).get('/api/unknown');
    expect(response.status).toBe(404);
    expect(response.type).toBe('application/json');
  });

  it('serves index.html for a non-api deep link', async () => {
    const response = await request(app.getHttpServer()).get('/login');
    expect(response.status).toBe(200);
    expect(response.text).toContain('<title>App</title>');
  });

  // The point of the middleware fallback: module registration order stops mattering, so
  // rooms/bookings/notifications can be plain feature modules imported in any position.
  it('lets a feature module registered after the SPA fallback keep its /api route', async () => {
    const response = await request(app.getHttpServer()).get('/api/late');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
