import { Navigate, Outlet } from 'react-router';
import { AppSkeleton } from '../../components/AppSkeleton';
import { useCurrentUser } from './useCurrentUser';

/**
 * Layout route for /login and /register. It waits for /auth/me rather than
 * rendering the form optimistically, so a signed-in visitor never sees a
 * one-frame flash of the login screen before being sent home.
 */
export function RedirectIfAuthenticated() {
  const { data: user, isPending } = useCurrentUser();

  if (isPending) {
    return <AppSkeleton />;
  }
  if (user) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
