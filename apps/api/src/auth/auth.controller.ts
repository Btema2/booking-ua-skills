import { LoginSchema, type PublicUser, RegisterSchema } from '@booking/core';
import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { parseOrThrow } from '../common/parse-or-throw';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_SECURE,
  clearedSessionCookieOptions,
  readSessionCookie,
  sessionCookieOptions,
} from './session-cookie';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(SESSION_COOKIE_SECURE) private readonly cookieSecure: boolean,
  ) {}

  @Post('register')
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: PublicUser }> {
    const { user, sessionId } = await this.authService.register(parseOrThrow(RegisterSchema, body));
    response.cookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions(this.cookieSecure));
    return { user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response): Promise<{ user: PublicUser }> {
    const { user, sessionId } = await this.authService.login(parseOrThrow(LoginSchema, body));
    response.cookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions(this.cookieSecure));
    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.authService.logout(readSessionCookie(request));
    response.clearCookie(SESSION_COOKIE_NAME, clearedSessionCookieOptions(this.cookieSecure));
  }

  /** 200 with `user: null` for an anonymous visitor — this is the app's "am I signed in?" check, not a protected route. */
  @Get('me')
  async me(@Req() request: Request): Promise<{ user: PublicUser | null }> {
    const sessionId = readSessionCookie(request);
    const user = sessionId ? await this.authService.resolveSessionOrNull(sessionId) : null;
    return { user };
  }

  @Post('verify/resend')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async resendVerification(@CurrentUser() user: PublicUser): Promise<{ success: boolean }> {
    await this.authService.resendVerificationEmail(user.id);
    return { success: true };
  }

  @Post('verify/:token')
  @HttpCode(HttpStatus.OK)
  async verify(@Param('token') token: string): Promise<{ success: boolean }> {
    await this.authService.verifyEmail(token);
    return { success: true };
  }
}
