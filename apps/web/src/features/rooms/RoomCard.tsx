import { Link } from 'react-router';
import type { Room } from '@booking/core';
import { peopleLabel } from './plural';

const CARD =
  'flex h-full w-full flex-col items-start gap-[var(--room-card-gap)] ' +
  'rounded-lg border border-outline-variant bg-surface-container-low p-[var(--room-card-pad)] ' +
  'text-left';

export function RoomCard({ room }: { readonly room: Room }) {
  return (
    <Link to={`/rooms/${room.id}`} role="link" aria-label={room.name} className={CARD}>
      <div className="flex w-full items-start justify-between gap-s3">
        <div className="min-w-0">
          <span className="block font-heading text-[28px] leading-[1.1] font-display text-on-surface">
            {room.name}
          </span>
          {room.amenities === null ? null : (
            <p className="mt-s1 text-body-small text-on-surface-variant">{room.amenities}</p>
          )}
        </div>

        <span className="flex size-[var(--room-cap-badge)] shrink-0 items-center justify-center rounded-full bg-primary-container text-[15px] font-strong text-on-primary-container">
          <span aria-hidden="true">{room.capacity}</span>
          <span className="sr-only">Місткість: {peopleLabel(room.capacity)}</span>
        </span>
      </div>

      <span className="rounded-full bg-tertiary-container p-[var(--room-tag-pad)] text-label-medium text-on-tertiary-container">
        <span aria-hidden="true">{room.floor} поверх</span>
        <span className="sr-only">Поверх {room.floor}</span>
      </span>
    </Link>
  );
}
