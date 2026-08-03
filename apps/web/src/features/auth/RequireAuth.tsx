import { Navigate, Outlet } from 'react-router';
import { AppSkeleton } from '../../components/AppSkeleton';
import { NavBar } from '../../components/NavBar';
import { useCurrentUser } from './useCurrentUser';

/** Layout route for authenticated screens: the nav bar plus the routed content. */
export function RequireAuth() {
  const { data: user, isPending } = useCurrentUser();

  if (isPending) {
    return <AppSkeleton />;
  }
  // An anonymous visitor is `user: null`; a still-loading query is `undefined`. Either way, not signed in.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <NavBar userName={user.name} />
      <main className="mx-auto w-full max-w-[var(--page-max)] px-[var(--page-pad-x)] pt-[var(--page-pad-top)] pb-[var(--page-pad-bottom)]">
        <Outlet />
      </main>
    </div>
  );
}
