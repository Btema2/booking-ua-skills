import { useEffect, useRef, useState } from 'react';
import { formatInstantTime, getViewerZone } from '../rooms/timeUtils';
import { useNotifications } from './useNotifications';
import type { NotificationDTO } from './api';

// Matches the handoff's own toast lifetime (`toastTimer`, 5200ms).
const TOAST_DURATION_MS = 5200;

interface ToastContent {
  title: string;
  body: string;
  kind: string;
}

function toContent(n: NotificationDTO, notifyBeforeMinutes: number, viewerZone: string): ToastContent {
  if (n.kind === 'series_conflict') {
    return {
      title: 'Не вдалося створити повторювані зустрічі',
      body: n.message ?? '',
      kind: n.kind,
    };
  }
  const titleStr = n.bookingTitle ?? '';
  const roomStr = n.roomName ?? '';
  const endsAtStr = n.bookingEndsAt ? formatInstantTime(n.bookingEndsAt, viewerZone) : '';
  return {
    title: `Зустріч завершується за ${notifyBeforeMinutes} хв`,
    body: `«${titleStr}» · ${roomStr} · до ${endsAtStr}`,
    kind: n.kind,
  };
}

/**
 * Pops once per notification the poller has not seen before this session —
 * the backlog on first load is never "new", so it never toasts on mount.
 */
export function NotificationToast() {
  const { data } = useNotifications();
  const [toast, setToast] = useState<ToastContent | null>(null);
  const seenIds = useRef<Set<string> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!data) return;
    const rows = data.notifications;

    if (seenIds.current === null) {
      seenIds.current = new Set(rows.map((n) => n.id));
      return;
    }

    const fresh = rows.find((n) => !seenIds.current!.has(n.id));
    rows.forEach((n) => seenIds.current!.add(n.id));

    if (fresh) {
      clearTimeout(timerRef.current);
      setToast(toContent(fresh, data.notifyBeforeMinutes, getViewerZone()));
      timerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    }
  }, [data]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function dismiss() {
    clearTimeout(timerRef.current);
    setToast(null);
  }

  if (!toast) return null;

  const isConflict = toast.kind === 'series_conflict';

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'fixed z-[var(--z-toast)] top-[70px] right-4 flex w-[min(380px,calc(100vw-32px))] items-start gap-[13px]',
        'rounded-[var(--radius-lg,20px)] p-[15px_18px]',
        'supports-[backdrop-filter]:backdrop-blur-[var(--blur-toast)] supports-[backdrop-filter]:backdrop-saturate-[1.2]',
        'shadow-[var(--shadow-el-3)] border',
        isConflict
          ? 'bg-[var(--glass-toast-error)] text-on-error-container border-error/35'
          : 'bg-[var(--glass-toast)] text-on-surface border-outline-variant',
        '[animation:notif-toast-in_var(--dur-toast)_var(--ease-spring)_both]',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={`grid size-[30px] shrink-0 place-items-center rounded-full ${
          isConflict
            ? 'bg-error-container text-error border border-error/20'
            : 'bg-primary-container text-on-primary-container'
        }`}
      >
        {isConflict ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`m-0 mb-[2px] text-[14.5px] font-semibold leading-[1.35] ${isConflict ? 'text-on-error-container' : 'text-on-surface'}`}>
          {toast.title}
        </p>
        <p className={`m-0 text-body-small break-words ${isConflict ? 'text-on-error-container/85' : 'text-on-surface-variant'}`}>
          {toast.body}
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Закрити"
        className={`grid size-[28px] shrink-0 place-items-center rounded-full transition-colors ${
          isConflict ? 'text-on-error-container hover:bg-error/20' : 'text-on-surface-variant hover:bg-surface-container-highest'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
