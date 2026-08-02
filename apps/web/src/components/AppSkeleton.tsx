/**
 * Placeholder for the authenticated shell while /auth/me is still in flight.
 * It reserves the same bar + content rhythm the real screen uses, so resolving
 * the session does not shift the layout — and never flashes the login form.
 */
export function AppSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Завантаження"
      className="min-h-screen bg-slate-50"
    >
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="h-5 w-48 max-w-full animate-pulse rounded bg-slate-200" />
          <div className="h-5 w-28 max-w-full animate-pulse rounded bg-slate-200" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-4xl space-y-3 px-4 py-10">
        <div className="h-8 w-2/3 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  );
}
