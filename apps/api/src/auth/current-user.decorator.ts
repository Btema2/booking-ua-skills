import type { PublicUser } from '@booking/core';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { authenticationRequired } from './auth.errors';
import type { AuthenticatedRequest } from './authenticated-request';

/** Reads the user AuthGuard attached; rejects if the route was left unguarded. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): PublicUser => {
  const { currentUser } = context.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!currentUser) {
    throw authenticationRequired();
  }
  return currentUser;
});
