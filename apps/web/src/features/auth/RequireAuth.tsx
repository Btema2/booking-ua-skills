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
  // A failed /auth/me leaves `data` undefined; treat that as "not signed in".
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar userName={user.name} />
      <main className="mx-auto w-full max-w-4xl px-4 py-10">
        <Outlet />
      </main>
    </div>
  );
}
