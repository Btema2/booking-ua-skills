import { useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router';

type CapacityOption = {
  /** `undefined` is «Будь-яка» — the absence of a filter, not a capacity of zero. */
  readonly value: number | undefined;
  readonly label: string;
};

const ANY_CAPACITY: CapacityOption = { value: undefined, label: 'Будь-яка' };

function toOptions(thresholds: readonly number[]): readonly CapacityOption[] {
  return [ANY_CAPACITY, ...thresholds.map((value) => ({ value, label: `від ${value}` }))];
}

const MIN_CAPACITY_PARAM = 'minCapacity';

/**
 * The filter lives in the URL because it is shareable state: a link to
 * `/?minCapacity=8` reproduces the screen, and the back button undoes a choice.
 *
 * Any positive integer is accepted, not only the values the chip row happens to
 * offer. The chips are derived from the rooms that exist, so validating the URL
 * against them would make `?minCapacity=99` — a stale link, or a room that has
 * since shrunk — silently render the full list instead of the empty state.
 */
export function useCapacityFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(MIN_CAPACITY_PARAM);

  const parsed = raw === null || raw.trim() === '' ? Number.NaN : Number(raw);
  const minCapacity = Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;

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
  /** Ascending capacities to offer, from `capacityThresholds`. */
  readonly thresholds: readonly number[];
  readonly onChange: (value: number | undefined) => void;
};

export function CapacityFilter({ value, thresholds, onChange }: CapacityFilterProps) {
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const options = toOptions(thresholds);
  const selectedIndex = options.findIndex((option) => option.value === value);
  // A radiogroup is one tab stop: the checked chip carries it, arrows do the rest.
  // A URL value no chip offers (?minCapacity=99) selects nothing, so the stop
  // falls back to «Будь-яка» — the chip that gets the reader out of that state.
  const tabStopIndex = selectedIndex === -1 ? 0 : selectedIndex;

  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    const delta = ARROW_DELTA[event.key];
    if (delta === undefined) {
      return;
    }
    event.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    chipRefs.current[next]?.focus();
  }

  // One room, or six rooms that all hold the same number: no threshold divides
  // them, so a chip row would be «Будь-яка» alone. Render nothing instead.
  if (thresholds.length === 0) {
    return null;
  }

  return (
    <div
      role="radiogroup"
      aria-label="Фільтр за місткістю"
      className="flex flex-wrap gap-[var(--cap-chip-gap)]"
    >
      {options.map((option, index) => {
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
