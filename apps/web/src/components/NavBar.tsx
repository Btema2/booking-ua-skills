import { Link } from 'react-router';
import { useLogoutMutation } from '../features/auth/useAuthMutations';

export function NavBar({ userName }: { userName: string }) {
  const logout = useLogoutMutation();

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav
        aria-label="Головна навігація"
        className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3"
      >
        <Link to="/" className="text-base font-semibold text-slate-900 hover:text-slate-600">
          Бронювання переговорних
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <span className="min-w-0 truncate text-sm text-slate-600">{userName}</span>
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:ring-2 focus:ring-slate-300 focus:outline-none disabled:opacity-60"
          >
            {logout.isPending ? 'Вихід…' : 'Вийти'}
          </button>
        </div>
      </nav>
    </header>
  );
}
