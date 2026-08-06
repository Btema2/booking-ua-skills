import type { Room } from '@booking/core';
import { peopleLabel } from './plural';

const PANEL =
  'flex flex-col items-center gap-s3 rounded-lg border bg-surface-container-lowest ' +
  'px-s5 py-s7 text-center';

const ICON_CIRCLE = 'flex size-[48px] items-center justify-center rounded-full';

const STATE_TITLE = 'font-heading text-[19px] font-display text-on-surface';

const PILL_BASE =
  'cursor-pointer rounded-full border px-s5 py-s3 text-label-large ' +
  'transition-colors duration-[var(--dur-chip)] ease-spring ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

// Filled with --color-on-primary-container rather than --color-primary. The
// handoff pairs on-primary ink with a primary fill and annotates it "4.5:1"; the
// two values actually measure 4.38:1, which fails AA for 13.5px label text. The
// deeper oak of the same ramp carries the identical ink at 10.13:1.
const PILL_PRIMARY = `${PILL_BASE} border-on-primary-container bg-on-primary-container text-on-primary`;

const PILL_GHOST = `${PILL_BASE} border-outline-variant bg-transparent text-on-surface hover:bg-surface-container-high`;

/* ── Loading ─────────────────────────────────────────────────────────────── */

// `.skeleton-bar` and its keyframes live in styles.css, where AppSkeleton already
// uses them. Re-declaring the sweep here would put two copies of one primitive in
// the app, free to drift apart, and reinsert a <style> node on every filter change.
export function SkeletonBar({
  className = '',
  delay,
}: {
  readonly className?: string;
  readonly delay?: string;
}) {
  const roundedClass = className.includes('rounded-') ? '' : 'rounded-md';
  return (
    <span
      className={`skeleton-bar block ${roundedClass} ${className}`.trim()}
      style={delay ? { animationDelay: delay } : undefined}
    />
  );
}

/** Keeps the card's own shape, padding, and inner badge elements so nothing jumps when data loads. */
function SkeletonCard({ delay }: { readonly delay: string }) {
  return (
    <li
      aria-hidden="true"
      className="flex flex-col gap-[var(--room-card-gap)] rounded-[var(--radius-lg)] border border-outline-variant bg-surface-container-low p-[var(--room-card-pad)]"
    >
      {/* Header: Name + Capacity Circle */}
      <div className="flex items-start justify-between gap-s3">
        <div className="flex w-full flex-col gap-s2">
          <SkeletonBar className="h-[28px] w-3/5 rounded-md" delay={delay} />
          <SkeletonBar className="h-[13px] w-4/5 rounded-sm" delay={delay} />
        </div>
        <SkeletonBar className="size-[var(--room-cap-badge)] shrink-0 rounded-full" delay={delay} />
      </div>

      {/* Footer: Floor tag pill + Availability tag pill */}
      <div className="flex flex-wrap items-center gap-s2 pt-s1">
        <SkeletonBar className="h-[24px] w-[64px] rounded-full" delay={delay} />
        <SkeletonBar className="h-[24px] w-[130px] rounded-full" delay={delay} />
      </div>
    </li>
  );
}

export function RoomListLoading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Завантажуємо переговорні…</span>
      <ul className="grid grid-cols-[var(--room-grid-columns)] gap-[var(--room-grid-gap)]">
        <SkeletonCard delay="0s" />
        <SkeletonCard delay="0.15s" />
      </ul>
    </div>
  );
}

/* ── Empty ───────────────────────────────────────────────────────────────── */

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[22px]" fill="none">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type RoomListEmptyProps = {
  readonly largestRoom: Room | undefined;
  readonly hasFilter: boolean;
  readonly onClearFilter: () => void;
};

export function RoomListEmpty({ largestRoom, hasFilter, onClearFilter }: RoomListEmptyProps) {
  return (
    <div className={`${PANEL} border-outline-variant`}>
      <span className={`${ICON_CIRCLE} bg-surface-container-high text-on-surface-variant`}>
        <SearchGlyph />
      </span>
      <h2 className={STATE_TITLE}>Таких кімнат немає</h2>
      <p className="text-body-small text-on-surface-variant">
        {largestRoom === undefined
          ? 'Жодної переговорної ще не додано.'
          : `Найбільша переговорна — «${largestRoom.name}» на ${peopleLabel(largestRoom.capacity)}.`}
      </p>
      {hasFilter ? (
        <button type="button" className={PILL_GHOST} onClick={onClearFilter}>
          Показати всі
        </button>
      ) : null}
    </div>
  );
}

/* ── Error ───────────────────────────────────────────────────────────────── */

function AlertGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[22px]" fill="none">
      <path
        d="M12 4.5l8.5 15h-17l8.5-15z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.1" fill="currentColor" />
    </svg>
  );
}

type RoomListErrorProps = {
  readonly hasCachedCopy: boolean;
  readonly onRetry: () => void;
  readonly onShowCachedCopy: () => void;
};

export function RoomListError({ hasCachedCopy, onRetry, onShowCachedCopy }: RoomListErrorProps) {
  return (
    <div role="alert" className={`${PANEL} border-error-container`}>
      <span className={`${ICON_CIRCLE} bg-error-container text-on-error-container`}>
        <AlertGlyph />
      </span>
      <h2 className={STATE_TITLE}>Сервер не відповідає</h2>
      <p className="text-body-small text-on-surface-variant">
        Не вдалося завантажити список переговорних.
      </p>
      <div className="flex flex-wrap justify-center gap-s2">
        <button type="button" className={PILL_PRIMARY} onClick={onRetry}>
          Повторити
        </button>
        <button
          type="button"
          className={PILL_GHOST}
          onClick={onShowCachedCopy}
          disabled={!hasCachedCopy}
        >
          Показати збережену копію
        </button>
      </div>
    </div>
  );
}

/** Sits above the stale list once the reader has chosen to see it anyway. */
export function CachedCopyNotice({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <p className="flex flex-wrap items-center justify-between gap-s3 rounded-md border border-error-container bg-error-container p-s4 text-body-small text-on-error-container">
      Показано збережену копію — сервер не відповідає, дані можуть бути застарілими.
      <button type="button" className={PILL_GHOST} onClick={onRetry}>
        Повторити
      </button>
    </p>
  );
}
