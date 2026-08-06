import { NavLink, useLocation, useNavigate } from 'react-router';
import { useLogoutMutation } from '../features/auth/useAuthMutations';

/**
 * Mobile Bottom Bar (DESIGN-NOTES.md §6):
 * padding 12px 16px 16px, top 1px outline-variant, glass #e2d2b5 at 88% with
 * blur(14px) saturate(1.2), ~76px tall.
 * Nav items 60px wide, 19px icon, 10px/700 label.
 * CTA pill min-height 48px, padding 0 22px, Rubik 15px, primary fill.
 */
export function BottomBar({ onBookClick }: { onBookClick?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useLogoutMutation();

  const isSchedulePage = location.pathname.startsWith('/rooms/');

  return (
    <div
      aria-label="Мобільна навігація"
      className={[
        'fixed bottom-0 left-0 right-0 z-[var(--z-menu,45)] min-[761px]:hidden',
        'border-t border-outline-variant p-[12px_16px_16px]',
        'bg-[var(--glass-toast-fallback,#e2d2b5)]',
        'supports-[backdrop-filter]:bg-[var(--glass-toast,color-mix(in_srgb,#e2d2b5_88%,transparent))]',
        'supports-[backdrop-filter]:backdrop-blur-[14px]',
        'supports-[backdrop-filter]:backdrop-saturate-[1.2]',
        'flex items-center justify-between gap-s3 shadow-lg',
      ].join(' ')}
    >
      <div className="flex items-center gap-s3">
        {/* Nav Item 1: Rooms */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex w-[60px] flex-col items-center justify-center gap-1 rounded-xl py-1 transition-colors ${
              isActive
                ? 'text-primary font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`
          }
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-[0.05em] leading-none">
            Кімнати
          </span>
        </NavLink>

        {/* Nav Item 2: My Bookings */}
        <NavLink
          to="/my-bookings"
          className={({ isActive }) =>
            `flex w-[60px] flex-col items-center justify-center gap-1 rounded-xl py-1 transition-colors ${
              isActive
                ? 'text-primary font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`
          }
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-[0.05em] leading-none">
            Мої
          </span>
        </NavLink>
      </div>

      {/* Right side CTA or Logout */}
      {isSchedulePage ? (
        <button
          type="button"
          onClick={() => {
            if (onBookClick) {
              onBookClick();
            } else {
              // Fall back to finding first free slot or trigger click on free slot in schedule
              const firstFreeCell = document.querySelector<HTMLElement>('[data-grid-cell]');
              firstFreeCell?.click();
            }
          }}
          className="min-h-[48px] px-[22px] rounded-full bg-primary text-on-primary font-heading font-bold text-[15px] hover:bg-primary/90 transition-colors shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container shrink-0"
        >
          Забронювати
        </button>
      ) : (
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="min-h-[48px] px-[22px] rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant font-semibold text-[14px] hover:bg-surface-container-high hover:text-on-surface disabled:opacity-60 transition-colors shrink-0"
        >
          {logout.isPending ? 'Вихід…' : 'Вийти'}
        </button>
      )}
    </div>
  );
}
