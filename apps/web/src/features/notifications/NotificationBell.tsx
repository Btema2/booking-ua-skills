import { useEffect, useRef, useState } from 'react';
import { formatInstantTime, getViewerZone } from '../rooms/timeUtils';
import { useMarkNotificationRead } from './useMarkNotificationRead';
import { useNotifications } from './useNotifications';
import type { NotificationDTO } from './api';

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container';

function endingSoonTitle(notifyBeforeMinutes: number): string {
  return `Зустріч завершується за ${notifyBeforeMinutes} хв`;
}

function endingSoonBody(n: NotificationDTO, viewerZone: string): string {
  const title = n.bookingTitle ?? '';
  const room = n.roomName ?? '';
  const endsAt = n.bookingEndsAt ? formatInstantTime(n.bookingEndsAt, viewerZone) : '';
  return `«${title}» · ${room} · до ${endsAt}`;
}

/** Bell icon + trigger + dropdown menu — markup and copy per DESIGN-NOTES §4/§8. */
export function NotificationBell() {
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const viewerZone = getViewerZone();
  const notifications = data?.notifications ?? [];
  const notifyBeforeMinutes = data?.notifyBeforeMinutes ?? 10;
  const hasUnread = notifications.some((n) => !n.readAt);

  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  function toggleOpen() {
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening) {
      notifications.filter((n) => !n.readAt).forEach((n) => markRead.mutate(n.id));
    }
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Сповіщення"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls="notification-menu"
        className={[
          'grid size-[var(--nav-icon-btn)] place-items-center rounded-full border border-outline-variant',
          'bg-surface-container-lowest transition-colors duration-[var(--dur-chip)]',
          'hover:bg-surface-container-high',
          FOCUS_RING,
        ].join(' ')}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        </svg>
        {hasUnread && (
          <span
            aria-hidden="true"
            className="absolute top-[6px] right-[7px] size-[9px] rounded-full border-2 border-surface-container-lowest bg-error"
          />
        )}
      </button>

      {isOpen && (
        <div
          id="notification-menu"
          role="region"
          aria-label="Сповіщення"
          className={[
            'absolute z-[var(--z-menu)] top-[calc(100%+10px)] right-0 w-[min(330px,calc(100vw-32px))] p-s2 rounded-[var(--radius-lg,20px)]',
            'max-h-[min(520px,calc(100vh-100px))] flex flex-col',
            'max-sm:fixed max-sm:top-[70px] max-sm:right-4 max-sm:w-[calc(100vw-32px)] max-sm:max-w-[330px]',
            'bg-[var(--glass-menu)] supports-[backdrop-filter]:backdrop-blur-[var(--blur-menu)]',
            'shadow-[var(--shadow-el-3)] border border-outline-variant',
            '[animation:notif-menu-in_var(--dur-menu)_var(--ease-spring)_both]',
          ].join(' ')}
        >
          <p className="m-0 mb-s2 px-s2 pt-s2 text-[11px] font-bold tracking-[0.06em] uppercase text-on-surface-variant shrink-0">
            Сповіщення
          </p>

          {notifications.length === 0 ? (
            <div className="px-s2 py-s4 text-center">
              <p className="m-0 mb-1 text-body-medium font-semibold text-on-surface">Сповіщень немає</p>
              <p className="m-0 text-body-small text-on-surface-variant">
                Ми нагадаємо за {notifyBeforeMinutes} хв до кінця вашої зустрічі.
              </p>
            </div>
          ) : (
            <ul className="m-0 list-none p-0 overflow-y-auto max-h-[440px] flex-1 pr-1">
              {notifications.map((n) => {
                const isSeriesConflict = n.kind === 'series_conflict';
                const title = isSeriesConflict
                  ? 'Не вдалося створити повторювані зустрічі'
                  : endingSoonTitle(notifyBeforeMinutes);
                const body = isSeriesConflict
                  ? (n.message ?? '')
                  : endingSoonBody(n, viewerZone);

                return (
                  <li
                    key={n.id}
                    className="mb-s1 flex gap-[11px] rounded-[var(--radius-md,14px)] bg-surface-container-lowest p-[11px_10px] last:mb-0"
                  >
                    <span
                      aria-hidden="true"
                      className={`grid size-[30px] shrink-0 place-items-center rounded-full ${
                        isSeriesConflict
                          ? 'bg-error-container text-on-error-container'
                          : 'bg-primary-container text-on-primary-container'
                      }`}
                    >
                      {isSeriesConflict ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7v5l3 2" />
                        </svg>
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="m-0 mb-[2px] text-body-medium font-semibold text-on-surface">
                        {title}
                      </p>
                      <p className="m-0 text-body-small text-on-surface-variant">{body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
