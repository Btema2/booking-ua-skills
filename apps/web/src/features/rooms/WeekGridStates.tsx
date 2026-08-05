import React from 'react';

/**
 * Skeleton bar helper utilizing the `.skeleton-bar` CSS class declared in styles.css.
 * Applies --pattern-skeleton shimmer animation over surface-container blocks.
 */
function SkeletonBar({
  className = '',
  delay,
}: {
  readonly className?: string;
  readonly delay?: string;
}) {
  return (
    <span
      className={`skeleton-bar block rounded-full ${className}`}
      style={delay ? { animationDelay: delay } : undefined}
    />
  );
}

/* ── Loading State ───────────────────────────────────────────────────────── */

export type WeekGridLoadingProps = {
  readonly daysCount?: number;
};

/**
 * Week schedule loading state (DESIGN-NOTES.md §8).
 * Displays caption «Завантажуємо розклад…» over a shimmering block skeleton that
 * KEEPS the grid shape. Never uses a centred spinner.
 */
export function WeekGridLoading({ daysCount = 5 }: WeekGridLoadingProps) {
  const days = Array.from({ length: daysCount });

  return (
    <div role="status" aria-busy="true" className="w-full">
      <p className="mb-s2 text-body-small font-medium text-on-surface-variant">
        Завантажуємо розклад…
      </p>

      <div className="overflow-clip rounded-lg border border-outline-variant bg-surface-container-lowest">
        {/* Sticky Header Skeleton */}
        <div
          className="grid border-b border-outline-variant bg-surface-container"
          style={{ gridTemplateColumns: `var(--time-gutter-w) repeat(${daysCount}, minmax(0, 1fr))` }}
        >
          <div className="h-[var(--grid-head-h)] border-r border-outline-variant p-s2" />
          {days.map((_, index) => (
            <div
              key={index}
              className="flex h-[var(--grid-head-h)] flex-col items-center justify-center gap-s1 border-r border-outline-variant p-s2 last:border-r-0"
            >
              <SkeletonBar className="h-3 w-8" delay={`${index * 0.05}s`} />
              <SkeletonBar className="h-5 w-6" delay={`${index * 0.05 + 0.1}s`} />
            </div>
          ))}
        </div>

        {/* Grid Body Skeleton keeping full grid geometry */}
        <div
          className="grid h-[440px] overflow-hidden"
          style={{ gridTemplateColumns: `var(--time-gutter-w) repeat(${daysCount}, minmax(0, 1fr))` }}
        >
          {/* Time Gutter */}
          <div className="flex flex-col border-r border-outline-variant bg-surface-container-low py-s2">
            {['09:00', '11:00', '13:00', '15:00', '17:00'].map((time, i) => (
              <div key={time} className="flex h-[88px] items-start justify-end px-s2">
                <SkeletonBar className="h-3 w-10" delay={`${i * 0.1}s`} />
              </div>
            ))}
          </div>

          {/* Day Columns with staggered booking block skeletons */}
          {days.map((_, colIndex) => (
            <div
              key={colIndex}
              className="relative flex flex-col gap-s3 border-r border-outline-variant p-s2 last:border-r-0"
            >
              <div className="flex flex-col gap-s4 py-s2">
                <SkeletonBar
                  className="h-16 w-full rounded-[var(--block-radius)]"
                  delay={`${colIndex * 0.1}s`}
                />
                <SkeletonBar
                  className="h-24 w-full rounded-[var(--block-radius)]"
                  delay={`${colIndex * 0.15 + 0.1}s`}
                />
                <SkeletonBar
                  className="h-12 w-full rounded-[var(--block-radius)]"
                  delay={`${colIndex * 0.1 + 0.2}s`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Empty State ─────────────────────────────────────────────────────────── */

export type WeekGridEmptyProps = {
  readonly daysCount?: number;
  readonly dayNames?: readonly string[];
};

const DEFAULT_DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

/**
 * Week schedule empty state (DESIGN-NOTES.md §8).
 * Flat 5-column (or 7-column) tint block with «Цього тижня все вільно» /
 * «Жодного бронювання — оберіть будь-який слот».
 */
export function WeekGridEmpty({ daysCount = 5, dayNames }: WeekGridEmptyProps) {
  const columns = dayNames ?? DEFAULT_DAY_NAMES.slice(0, daysCount);

  return (
    <div role="status" className="w-full">
      <div className="relative overflow-clip rounded-lg border border-outline-variant bg-surface-container-lowest">
        {/* Day Header Row */}
        <div
          className="grid border-b border-outline-variant bg-surface-container"
          style={{ gridTemplateColumns: `var(--time-gutter-w) repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          <div className="h-[var(--grid-head-h)] border-r border-outline-variant" />
          {columns.map((day, index) => (
            <div
              key={index}
              className="flex h-[var(--grid-head-h)] items-center justify-center border-r border-outline-variant text-label-small font-bold text-on-surface-variant last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Flat Column Tint Block Body */}
        <div className="relative min-h-[360px] bg-surface-container-lowest">
          <div
            className="absolute inset-0 grid"
            style={{ gridTemplateColumns: `var(--time-gutter-w) repeat(${columns.length}, minmax(0, 1fr))` }}
          >
            <div className="border-r border-outline-variant bg-surface-container-low" />
            {columns.map((_, index) => (
              <div
                key={index}
                className="border-r border-outline-variant bg-surface-container-lowest/50 last:border-r-0"
              />
            ))}
          </div>

          {/* Empty Messaging */}
          <div className="relative z-10 flex min-h-[360px] flex-col items-center justify-center gap-s2 p-s6 text-center">
            <h3 className="font-heading text-headline-medium font-display text-on-surface">
              Цього тижня все вільно
            </h3>
            <p className="text-body-medium text-on-surface-variant">
              Жодного бронювання — оберіть будь-який слот
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Error State ─────────────────────────────────────────────────────────── */

export type WeekGridErrorProps = {
  readonly onRetry?: () => void;
  readonly children?: React.ReactNode;
  readonly daysCount?: number;
};

/**
 * Fallback grid frame rendered when WeekGridError has no children passed.
 */
function DefaultFallbackGrid({ daysCount = 5 }: { readonly daysCount: number }) {
  const columns = DEFAULT_DAY_NAMES.slice(0, daysCount);

  return (
    <div className="overflow-clip rounded-lg border border-outline-variant bg-surface-container-lowest">
      <div
        className="grid border-b border-outline-variant bg-surface-container"
        style={{ gridTemplateColumns: `var(--time-gutter-w) repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        <div className="h-[var(--grid-head-h)] border-r border-outline-variant" />
        {columns.map((day, index) => (
          <div
            key={index}
            className="flex h-[var(--grid-head-h)] items-center justify-center border-r border-outline-variant text-label-small font-bold text-on-surface-variant last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="h-[360px] bg-surface-container-lowest" />
    </div>
  );
}

/**
 * Week schedule error state (DESIGN-NOTES.md §8).
 * Renders an error banner «Розклад може бути застарілим» with an «Оновити зараз» action button.
 * Drops grid to `opacity-45 grayscale-[35%]`.
 */
export function WeekGridError({ onRetry, children, daysCount = 5 }: WeekGridErrorProps) {
  return (
    <div role="alert" className="w-full">
      {/* Error banner */}
      <div className="bg-error-container text-on-error-container p-s3 rounded-md mb-s4 flex items-center justify-between">
        <span className="text-body-medium font-medium">Розклад може бути застарілим</span>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer rounded-full bg-on-error-container px-s4 py-s2 text-label-large font-semibold text-on-error transition-colors hover:bg-on-error-container/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-error-container"
          >
            Оновити зараз
          </button>
        ) : null}
      </div>

      {/* Grid container dropped to opacity-45 grayscale-[35%] */}
      <div className="opacity-45 grayscale-[35%] pointer-events-none" aria-disabled="true">
        {children ?? <DefaultFallbackGrid daysCount={daysCount} />}
      </div>
    </div>
  );
}
