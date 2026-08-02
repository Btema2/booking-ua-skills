import type { PublicUser } from '@booking/core';
import type { Request } from 'express';

/** AuthGuard writes `currentUser`; the `@CurrentUser()` decorator reads it back. */
export interface AuthenticatedRequest extends Request {
  currentUser?: PublicUser;
}
