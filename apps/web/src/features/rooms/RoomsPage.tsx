import { useEffect, useState } from 'react';
import type { Room } from '@booking/core';
import { CapacityFilter, useCapacityFilter } from './CapacityFilter';
import { RoomCard } from './RoomCard';
import { CachedCopyNotice, RoomListEmpty, RoomListError, RoomListLoading } from './RoomListStates';
import { useLargestRoom, useRooms } from './useRooms';

function RoomGrid({ rooms }: { readonly rooms: readonly Room[] }) {
  return (
    <ul
      aria-label="Список переговорних"
      className="grid grid-cols-[var(--room-grid-columns)] gap-[var(--room-grid-gap)]"
    >
      {rooms.map((room) => (
        <li key={room.id}>
          <RoomCard room={room} />
        </li>
      ))}
    </ul>
  );
}

export function RoomsPage() {
  const { minCapacity, setMinCapacity } = useCapacityFilter();
  const rooms = useRooms(minCapacity);

  // Whether the reader has accepted a stale list is a UI decision, not server
  // state, so it lives here — and it resets whenever the filter moves on.
  const [isShowingCachedCopy, setShowingCachedCopy] = useState(false);
  useEffect(() => setShowingCachedCopy(false), [minCapacity]);

  const hasFilter = minCapacity !== undefined;
  const isEmptyUnderFilter = hasFilter && rooms.isSuccess && rooms.data.length === 0;
  const largestRoom = useLargestRoom(isEmptyUnderFilter);

  const isShowingStaleList = rooms.isError && isShowingCachedCopy && rooms.data !== undefined;

  function renderList() {
    if (rooms.isPending) {
      return <RoomListLoading />;
    }
    if (rooms.isError && !isShowingStaleList) {
      return (
        <RoomListError
          hasCachedCopy={rooms.data !== undefined}
          onRetry={() => void rooms.refetch()}
          onShowCachedCopy={() => setShowingCachedCopy(true)}
        />
      );
    }
    const list = rooms.data ?? [];
    return (
      <>
        {/* Stays above the list even when the saved copy itself was empty. */}
        {isShowingStaleList ? <CachedCopyNotice onRetry={() => void rooms.refetch()} /> : null}
        {list.length === 0 ? (
          <RoomListEmpty
            largestRoom={largestRoom}
            hasFilter={hasFilter}
            onClearFilter={() => setMinCapacity(undefined)}
          />
        ) : (
          <RoomGrid rooms={list} />
        )}
      </>
    );
  }

  return (
    // The page frame — max width and padding — belongs to RequireAuth's <main>,
    // which wraps this via <Outlet />. Repeating it here would double every value.
    <section className="flex flex-col gap-s5">
      <header className="flex flex-col gap-s2">
        <h1 className="font-heading text-h1-fluid font-display text-on-surface">Переговорні</h1>
        <p className="max-w-[60ch] text-body-large text-on-surface-variant">
          Оберіть кімнату та вільний слот — бронювання з’явиться тут одразу.
        </p>
      </header>

      <CapacityFilter value={minCapacity} onChange={setMinCapacity} />

      <div className="flex flex-col gap-s4">{renderList()}</div>
    </section>
  );
}
