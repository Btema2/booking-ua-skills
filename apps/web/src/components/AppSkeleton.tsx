/**
 * Placeholder for the authenticated shell while /auth/me is still in flight.
 * It reserves the same bar + content rhythm the real screen uses, so resolving
 * the session does not shift the layout — and never flashes the login form.
 *
 * DESIGN-NOTES §8: loading keeps the layout. Shimmering bars on
 * --color-surface-container, staggered .15s, never a centred spinner.
 */

/** `.skeleton-bar` carries --pattern-skeleton + --dur-shimmer; see src/styles.css. */
export function AppSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Завантаження" className="min-h-screen bg-surface">
      <div className="border-b-[length:var(--border-hairline)] border-outline-variant bg-[var(--glass-appbar-fallback)]">
        <div className="mx-auto flex h-[var(--appbar-h)] w-full max-w-[var(--page-max)] items-center gap-[var(--appbar-gap)] p-[var(--appbar-pad)] max-desktop:gap-[var(--appbar-gap-mobile)] max-desktop:p-[var(--appbar-pad-mobile)]">
          <span className="skeleton-bar block h-6 w-36 rounded-md" />
          <div className="ml-auto flex items-center gap-s3">
            <span className="skeleton-bar block h-8 w-24 rounded-full [animation-delay:0.1s]" />
            <span className="skeleton-bar block size-9 rounded-full [animation-delay:0.15s]" />
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[var(--page-max)] flex-col gap-s4 px-[var(--page-pad-x)] pt-[var(--page-pad-top)] pb-[var(--page-pad-bottom)]">
        <span className="skeleton-bar block h-10 w-48 rounded-md" />
        <span className="skeleton-bar block h-4 w-full max-w-xl rounded-sm [animation-delay:0.15s]" />
        <span className="skeleton-bar block h-64 w-full rounded-[var(--radius-lg)] [animation-delay:0.25s]" />
      </div>
    </div>
  );
}
