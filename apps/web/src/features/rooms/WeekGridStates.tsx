const DEFAULT_DAY_NAMES = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'НД'];

/**
 * Skeleton bar helper utilizing the `.skeleton-bar` CSS class declared in styles.css.
 * Applies --pattern-skeleton shimmer animation over surface-container blocks.
 */
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

/* ── Loading State ───────────────────────────────────────────────────────── */

export type WeekGridLoadingProps = {
  readonly daysCount?: number;
};

/**
 * Week schedule loading state (DESIGN-NOTES.md §8).
 * Displays caption «Завантажуємо розклад…» over a shimmering block skeleton that
 * KEEPS the grid shape. Never uses a centred spinner.
 */
export function WeekGridLoading({ daysCount = 7 }: WeekGridLoadingProps) {
  const days = Array.from({ length: daysCount });

  return (
    <div role="status" aria-busy="true" className="w-full">
      <p className="mb-s2 text-body-small font-medium text-on-surface-variant">
        Завантажуємо розклад…
      </p>

      <div className="overflow-clip rounded-[var(--radius-lg)] border border-outline-variant bg-surface-container-lowest">
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

        {/* Grid Body Skeleton keeping full 20-row grid geometry */}
        <div
          className="grid overflow-hidden"
          style={{
            gridTemplateColumns: `var(--time-gutter-w) repeat(${daysCount}, minmax(0, 1fr))`,
            gridTemplateRows: 'repeat(20, var(--slot-h))',
          }}
        >
          {/* Time Gutter */}
          <div
            className="grid border-r border-outline-variant bg-surface-container-lowest"
            style={{ gridTemplateRows: 'repeat(20, var(--slot-h))' }}
          >
            {Array.from({ length: 20 }, (_, rowIndex) => {
              const isHourRow = rowIndex % 2 === 0;
              const timeIndex = Math.floor(rowIndex / 2);
              return (
                <div
                  key={rowIndex}
                  className={
                    isHourRow
                      ? 'border-t border-outline-variant px-s2 pt-[2px]'
                      : 'border-t border-[var(--color-rule-half-hour)]'
                  }
                >
                  {isHourRow ? (
                    <SkeletonBar className="h-3 w-10 ml-auto" delay={`${timeIndex * 0.05}s`} />
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Day Columns with staggered booking block skeletons */}
          {days.map((_, colIndex) => (
            <div
              key={colIndex}
              className="relative grid border-r border-outline-variant p-s1 last:border-r-0"
              style={{ gridTemplateRows: 'repeat(20, var(--slot-h))' }}
            >
              <div
                className="col-span-1 rounded-[var(--block-radius)] p-s1"
                style={{ gridRow: '2 / span 3' }}
              >
                <SkeletonBar className="h-full w-full rounded-[var(--block-radius)]" delay={`${colIndex * 0.1}s`} />
              </div>
              <div
                className="col-span-1 rounded-[var(--block-radius)] p-s1"
                style={{ gridRow: '7 / span 4' }}
              >
                <SkeletonBar className="h-full w-full rounded-[var(--block-radius)]" delay={`${colIndex * 0.15 + 0.1}s`} />
              </div>
            </div>
          ))}
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
export function DefaultFallbackGrid({ daysCount = 5 }: { readonly daysCount: number }) {
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
