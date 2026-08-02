import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { AuthRepository } from './auth/auth.repository';
import { SESSION_COOKIE_SECURE } from './auth/session-cookie';
import { SpaController } from './static/spa.controller';

describe('AppModule', () => {
  it('registers SpaController last, since nest g controller appends new entries and its wildcard route would shadow anything after it', () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AppModule) as unknown[];
    expect(controllers[controllers.length - 1]).toBe(SpaController);
  });

  // The same hazard bites across modules: the root module is scanned first, so an
  // AuthController declared inside AuthModule would answer 404 from the wildcard
  // instead of 401. Declaring it in this module's controllers array is what fixes it.
  it('routes /api/auth to AuthController rather than SpaController’s wildcard', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthRepository)
      .useValue({})
      .overrideProvider(SESSION_COOKIE_SECURE)
      .useValue(false)
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    try {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    } finally {
      await app.close();
    }
  });
});
