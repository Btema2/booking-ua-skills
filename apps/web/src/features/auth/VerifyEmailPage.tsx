import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { AuthCard } from './AuthCard';
import { useVerifyEmailMutation } from './useAuthMutations';
import { useCurrentUser } from './useCurrentUser';
import { ApiError } from '../../lib/api';

const ICON_CIRCLE = 'flex size-[52px] items-center justify-center rounded-full shadow-sm';

function SuccessIcon() {
  return (
    <span className={`${ICON_CIRCLE} bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)]`}>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-[24px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9.5" />
        <path d="m8 12 3 3 5-6" />
      </svg>
    </span>
  );
}

function ErrorIcon() {
  return (
    <span className={`${ICON_CIRCLE} bg-[var(--color-error-container)] text-[var(--color-on-error-container)]`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[24px]" fill="none">
        <path
          d="M12 4.5l8.5 15h-17l8.5-15z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M12 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1.1" fill="currentColor" />
      </svg>
    </span>
  );
}

export function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const { data: user } = useCurrentUser();
  const verify = useVerifyEmailMutation();
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current || !token) {
      return;
    }
    requested.current = true;
    verify.mutate(token);
  }, [token, verify]);

  const continueTo = user ? '/' : '/login';
  const continueLabel = user ? 'До кімнат' : 'Увійти';

  return (
    <AuthCard
      title="Підтвердження email"
      subtitle="Перевіряємо ваш поштовий ящик для доступу до бронювань."
      footer={
        <Link
          to={continueTo}
          style={{ background: 'var(--auth-glaze-primary)' }}
          className="inline-flex w-full items-center justify-center rounded-full shadow-[var(--auth-glaze-primary-shadow)] text-[var(--auth-glaze-primary-ink)] min-h-[var(--auth-glaze-primary-min-h)] px-6 py-3 text-label-large font-semibold hover:brightness-105 transition-all"
        >
          {continueLabel}
        </Link>
      }
    >
      <div className="py-4 flex flex-col items-center gap-4 text-center">
        {verify.isPending || verify.isIdle ? (
          <p className="text-body-medium text-[var(--color-on-surface-variant)] animate-pulse">Підтверджуємо пошту…</p>
        ) : verify.isSuccess ? (
          <>
            <SuccessIcon />
            <p className="text-body-medium font-medium text-[var(--color-on-surface)]">
              Пошту підтверджено. Тепер можна створювати бронювання.
            </p>
          </>
        ) : (
          <>
            <ErrorIcon />
            <div className="space-y-1">
              <p className="text-body-medium font-medium text-[var(--color-on-surface)]">
                {verify.error instanceof ApiError
                  ? verify.error.message
                  : 'Не вдалося підтвердити пошту.'}
              </p>
              <p className="text-body-small text-[var(--color-on-surface-variant)]">
                Увійдіть в акаунт і надішліть нове посилання.
              </p>
            </div>
          </>
        )}
      </div>
    </AuthCard>
  );
}

