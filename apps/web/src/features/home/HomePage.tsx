import { useCurrentUser } from '../auth/useCurrentUser';

/**
 * Phase 1 landing: proof the session works, nothing more. The room list and the
 * week grid arrive in later phases.
 */
export function HomePage() {
  const { data: user } = useCurrentUser();

  // RequireAuth only renders this route with a user in cache; this narrows the type.
  if (!user) {
    return null;
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Вітаємо, {user.name}!</h1>
      <p className="mt-2 text-slate-600">Ви увійшли до системи бронювання переговорних.</p>
    </section>
  );
}
