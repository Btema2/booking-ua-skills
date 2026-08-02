import { LoginSchema, type PublicUser, RegisterSchema } from '@booking/core';
import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
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

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: PublicUser): { user: PublicUser } {
    return { user };
  }
}
