import { Module } from '@nestjs/common';
import { loadEnv } from '../config/env';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { DrizzleAuthRepository } from './drizzle-auth.repository';
import { SESSION_COOKIE_SECURE } from './session-cookie';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    { provide: AuthRepository, useClass: DrizzleAuthRepository },
    { provide: SESSION_COOKIE_SECURE, useFactory: () => loadEnv().COOKIE_SECURE },
  ],
  exports: [AuthService, SESSION_COOKIE_SECURE],
})
export class AuthModule {}
