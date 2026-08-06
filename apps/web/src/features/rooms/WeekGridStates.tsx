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

const DAY_LABELS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'НД'];
const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

// Staggered booking block slot positions per day column (gridRow span rules)
const STAGGERED_BOOKINGS: Array<Array<{ row: string }>> = [
  [{ row: '2 / span 3' }, { row: '9 / span 4' }],   // Day 0 (ПН): 09:30-11:00, 13:00-15:00
  [{ row: '3 / span 4' }, { row: '12 / span 3' }],  // Day 1 (ВТ): 10:00-12:00, 14:30-16:00
  [{ row: '1 / span 3' }, { row: '8 / span 4' }],   // Day 2 (СР): 09:00-10:30, 12:30-14:30
  [{ row: '4 / span 4' }, { row: '14 / span 3' }],  // Day 3 (ЧТ): 10:30-12:30, 15:30-17:00
  [{ row: '2 / span 4' }, { row: '10 / span 3' }],  // Day 4 (ПТ): 09:30-11:30, 13:30-15:00
  [{ row: '5 / span 3' }],                           // Day 5 (СБ): 11:00-12:30
  [{ row: '3 / span 3' }],                           // Day 6 (НД): 10:00-11:30
];

export type WeekGridLoadingProps = {
  readonly daysCount?: number;
};

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
              className="flex h-[var(--grid-head-h)] flex-col items-center justify-center gap-1 border-r border-outline-variant p-s2 last:border-r-0"
            >
              <span className="text-label-small font-bold text-on-surface-variant">
                {DAY_LABELS[index % DAY_LABELS.length]}
              </span>
              <SkeletonBar className="h-3.5 w-6 rounded-full" delay={`${index * 0.05}s`} />
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
          {/* Time Gutter with static hour labels */}
          <div
            className="grid border-r border-outline-variant bg-surface-container-lowest"
            style={{ gridTemplateRows: 'repeat(20, var(--slot-h))' }}
          >
            {Array.from({ length: 20 }, (_, rowIndex) => {
              const isHourRow = rowIndex % 2 === 0;
              const hourText = HOURS[Math.floor(rowIndex / 2)];
              return (
                <div
                  key={rowIndex}
                  className={
                    isHourRow
                      ? 'border-t border-outline-variant px-s2 pt-[2px] text-right text-label-small font-bold text-on-surface-variant tabular-nums'
                      : 'border-t border-[var(--color-rule-half-hour)]'
                  }
                >
                  {isHourRow ? hourText : null}
                </div>
              );
            })}
          </div>

          {/* Day Columns with realistic rectangular booking card skeletons */}
          {days.map((_, colIndex) => {
            const bookings = STAGGERED_BOOKINGS[colIndex % STAGGERED_BOOKINGS.length];
            return (
              <div
                key={colIndex}
                className="relative grid border-r border-outline-variant p-[var(--cell-pad)] last:border-r-0"
                style={{ gridTemplateRows: 'repeat(20, var(--slot-h))' }}
              >
                {bookings.map((b, bIdx) => (
                  <div
                    key={bIdx}
                    className="col-span-1 flex flex-col justify-between rounded-[var(--block-radius)] border border-outline-variant/40 bg-surface-container p-s2 shadow-xs"
                    style={{ gridRow: b.row }}
                  >
                    <SkeletonBar className="h-3 w-3/4 rounded-xs bg-surface-container-high" delay={`${(colIndex * 2 + bIdx) * 0.08}s`} />
                    <SkeletonBar className="h-2.5 w-1/2 rounded-xs bg-surface-container-high" delay={`${(colIndex * 2 + bIdx) * 0.08 + 0.04}s`} />
                  </div>
                ))}
              </div>
            );
          })}
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
