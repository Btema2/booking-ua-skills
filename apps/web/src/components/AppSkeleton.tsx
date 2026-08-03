/**
 * Placeholder for the authenticated shell while /auth/me is still in flight.
 * It reserves the same bar + content rhythm the real screen uses, so resolving
 * the session does not shift the layout — and never flashes the login form.
 *
 * DESIGN-NOTES §8: loading keeps the layout. Shimmering bars on
 * --color-surface-container, staggered .15s, never a centred spinner.
 */

/** `.skeleton-bar` carries --pattern-skeleton + --dur-shimmer; see src/styles.css. */
const BAR = 'skeleton-bar rounded-full';

export function AppSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Завантаження" className="min-h-screen bg-surface">
      <div className="border-b-[length:var(--border-hairline)] border-outline-variant bg-[var(--glass-appbar-fallback)]">
        <div className="mx-auto flex h-[var(--appbar-h)] w-full max-w-[var(--page-max)] items-center gap-[var(--appbar-gap)] p-[var(--appbar-pad)] max-desktop:gap-[var(--appbar-gap-mobile)] max-desktop:p-[var(--appbar-pad-mobile)]">
          <div className={`${BAR} h-5 w-40 max-w-full`} />
          <div className={`${BAR} ml-auto h-8 w-28 max-w-full [animation-delay:0.15s]`} />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[var(--page-max)] flex-col gap-s4 px-[var(--page-pad-x)] pt-[var(--page-pad-top)] pb-[var(--page-pad-bottom)]">
        <div className={`${BAR} h-11 w-2/3 max-w-lg`} />
        <div className={`${BAR} h-4 w-full max-w-2xl [animation-delay:0.15s]`} />
        <div className={`${BAR} h-4 w-5/6 max-w-xl [animation-delay:0.3s]`} />
      </div>
    </div>
  );
}
