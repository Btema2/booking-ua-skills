import { Module } from '@nestjs/common';
import { loadEnv } from '../config/env';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { DrizzleAuthRepository } from './drizzle-auth.repository';
import { SESSION_COOKIE_SECURE } from './session-cookie';

// AuthController is registered in AppModule rather than here on purpose: Nest matches
// routes in module registration order and the root module is scanned first, so
// SpaController's wildcard would shadow every /api/auth route declared downstream.
@Module({
  providers: [
    AuthService,
    { provide: AuthRepository, useClass: DrizzleAuthRepository },
    { provide: SESSION_COOKIE_SECURE, useFactory: () => loadEnv().COOKIE_SECURE },
  ],
  exports: [AuthService, SESSION_COOKIE_SECURE],
})
export class AuthModule {}
