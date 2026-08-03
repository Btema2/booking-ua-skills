import { useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router';

type CapacityOption = {
  /** `undefined` is «Будь-яка» — the absence of a filter, not a capacity of zero. */
  readonly value: number | undefined;
  readonly label: string;
};

const CAPACITY_OPTIONS: readonly CapacityOption[] = [
  { value: undefined, label: 'Будь-яка' },
  { value: 4, label: 'від 4' },
  { value: 6, label: 'від 6' },
  { value: 8, label: 'від 8' },
  { value: 12, label: 'від 12' },
  { value: 20, label: 'від 20' },
];

const MIN_CAPACITY_PARAM = 'minCapacity';

/**
 * The filter lives in the URL because it is shareable state: a link to
 * `/?minCapacity=8` reproduces the screen, and the back button undoes a choice.
 */
export function useCapacityFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(MIN_CAPACITY_PARAM);

  // Never trust the URL — only a value the chip row can actually show counts.
  const minCapacity = CAPACITY_OPTIONS.find(
    (option) => option.value !== undefined && String(option.value) === raw,
  )?.value;

  const setMinCapacity = useCallback(
    (value: number | undefined) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (value === undefined) {
          next.delete(MIN_CAPACITY_PARAM);
        } else {
          next.set(MIN_CAPACITY_PARAM, String(value));
        }
        return next;
      });
    },
    [setSearchParams],
  );

  return { minCapacity, setMinCapacity };
}

const CHIP_BASE =
  'cursor-pointer rounded-full border p-[var(--cap-chip-pad)] text-label-large ' +
  'transition-colors duration-[var(--dur-chip)] ease-spring ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container';

// See the note on PILL_PRIMARY in RoomListStates: on-primary ink over a primary
// fill measures 4.38:1, below AA for this 13.5px label. Same ink, deeper fill.
const CHIP_SELECTED = 'border-on-primary-container bg-on-primary-container text-on-primary';

const CHIP_UNSELECTED =
  'border-outline-variant bg-surface-container-lowest text-on-surface-variant ' +
  'hover:bg-surface-container-high hover:text-on-surface';

const ARROW_DELTA: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

type CapacityFilterProps = {
  readonly value: number | undefined;
  readonly onChange: (value: number | undefined) => void;
};

export function CapacityFilter({ value, onChange }: CapacityFilterProps) {
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = CAPACITY_OPTIONS.findIndex((option) => option.value === value);
  // A radiogroup is one tab stop: the checked chip carries it, arrows do the rest.
  const tabStopIndex = selectedIndex === -1 ? 0 : selectedIndex;

  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    const delta = ARROW_DELTA[event.key];
    if (delta === undefined) {
      return;
    }
    event.preventDefault();
    const next = (index + delta + CAPACITY_OPTIONS.length) % CAPACITY_OPTIONS.length;
    onChange(CAPACITY_OPTIONS[next].value);
    chipRefs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Фільтр за місткістю"
      className="flex flex-wrap gap-[var(--cap-chip-gap)]"
    >
      {CAPACITY_OPTIONS.map((option, index) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.label}
            ref={(element) => {
              chipRefs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={index === tabStopIndex ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`${CHIP_BASE} ${isSelected ? CHIP_SELECTED : CHIP_UNSELECTED}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
