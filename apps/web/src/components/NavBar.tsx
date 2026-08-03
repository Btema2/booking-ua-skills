import { Link, NavLink } from 'react-router';
import { useLogoutMutation } from '../features/auth/useAuthMutations';

/**
 * The handoff draws no focus state for product screens (DESIGN-NOTES §7/§8), so
 * this is ours: a 2px ring in `--color-on-primary-container`, the darkest oak
 * ink the palette has. Over the app bar's own `--color-surface-container-low`
 * that measures ~8:1 — well clear of the 3:1 a non-text indicator needs, and
 * clear of the 7:1 floor the rest of the system holds itself to (§7). Deliberately
 * not `--color-primary`, which only reaches ~3.7:1 on the same surface.
 */
const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container';

/** Pill tab. Active gets the filled surface; NavLink adds aria-current="page". */
function navTabClass({ isActive }: { isActive: boolean }) {
  const base = [
    'inline-flex items-center rounded-full p-[var(--nav-tab-pad)] text-title-small',
    'max-desktop:p-[var(--nav-tab-pad-mobile)]',
    'transition-colors duration-[var(--dur-chip)] ease-[var(--ease-spring)]',
    'disabled:cursor-not-allowed disabled:opacity-50',
    FOCUS_RING,
  ].join(' ');

  return isActive
    ? `${base} bg-surface-container-highest text-on-surface`
    : `${base} text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface`;
}

export function NavBar({ userName }: { userName: string }) {
  const logout = useLogoutMutation();

  return (
    <header
      className={[
        // Glass over its solid fallback: browsers without backdrop-filter keep the
        // opaque --glass-appbar-fallback and never show text over bare content.
        'sticky top-0 z-[var(--z-appbar)] border-b-[length:var(--border-hairline)] border-outline-variant',
        'bg-[var(--glass-appbar-fallback)]',
        'supports-[backdrop-filter]:bg-[var(--glass-appbar)]',
        'supports-[backdrop-filter]:backdrop-blur-[var(--blur-appbar)]',
        'supports-[backdrop-filter]:backdrop-saturate-[var(--glass-appbar-saturate)]',
      ].join(' ')}
    >
      <nav
        aria-label="Головна навігація"
        className={[
          'mx-auto flex h-[var(--appbar-h)] w-full max-w-[var(--page-max)] items-center',
          'gap-[var(--appbar-gap)] p-[var(--appbar-pad)]',
          'max-desktop:gap-[var(--appbar-gap-mobile)] max-desktop:p-[var(--appbar-pad-mobile)]',
          'max-narrow:gap-[var(--appbar-gap-narrow)]',
        ].join(' ')}
      >
        <Link
          to="/"
          className={`shrink-0 rounded-full font-heading text-title-large text-on-surface max-narrow:hidden ${FOCUS_RING}`}
        >
          Переговорні
        </Link>

        {/* Tabs keep their size; the user pill next to them is what gives way. */}
        <ul className="flex shrink-0 items-center gap-s2 max-narrow:gap-s1">
          <li>
            <NavLink to="/" end className={navTabClass}>
              Кімнати
            </NavLink>
          </li>
          <li>
            {/*
              The screen behind this tab arrives in Phase 6. Rendering it as a live
              link would send the reader to /bookings, which the catch-all route
              redirects straight back to / with `replace` — a tab that appears to do
              nothing and cannot be undone with Back. A disabled button says the same
              thing honestly, and assistive tech announces the unavailability.
            */}
            <button type="button" disabled className={navTabClass({ isActive: false })}>
              Мої бронювання
            </button>
          </li>
        </ul>

        <div className="ml-auto flex min-w-0 items-center gap-s2">
          {/* Avatar + name pill — DESIGN-NOTES §4: 30px avatar, pill pad 5px 14px 5px 5px. */}
          <span className="flex min-w-0 items-center gap-s2 rounded-full bg-surface-container p-[5px] pr-[14px]">
            <span
              aria-hidden="true"
              className="grid size-[var(--nav-avatar)] shrink-0 place-items-center rounded-full bg-primary-container font-heading text-label-large text-on-primary-container"
            >
              {userName.slice(0, 1)}
            </span>
            <span className="min-w-0 truncate text-label-large text-on-surface-variant">
              {userName}
            </span>
          </span>

          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className={[
              'shrink-0 rounded-full border-[length:var(--border-hairline)] border-outline-variant',
              'bg-surface-container-lowest px-s4 py-s2 text-label-large text-on-surface-variant',
              'max-desktop:px-s3',
              'transition-colors duration-[var(--dur-chip)] ease-[var(--ease-spring)]',
              'hover:bg-surface-container-high hover:text-on-surface',
              'disabled:cursor-not-allowed disabled:opacity-60',
              FOCUS_RING,
            ].join(' ')}
          >
            {logout.isPending ? 'Вихід…' : 'Вийти'}
          </button>
        </div>
      </nav>
    </header>
  );
}
