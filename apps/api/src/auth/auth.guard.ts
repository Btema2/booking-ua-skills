import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { authenticationRequired } from './auth.errors';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './authenticated-request';
import { readSessionCookie } from './session-cookie';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionId = readSessionCookie(request);
    if (!sessionId) {
      throw authenticationRequired();
    }
    request.currentUser = await this.authService.resolveSession(sessionId);
    return true;
  }
}
