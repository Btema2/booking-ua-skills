import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { AuthCard } from './AuthCard';
import { useVerifyEmailMutation } from './useAuthMutations';
import { useCurrentUser } from './useCurrentUser';
import { ApiError } from '../../lib/api';

const ICON_CIRCLE = 'flex size-[48px] items-center justify-center rounded-full';

function SuccessIcon() {
  return (
    <span className={`${ICON_CIRCLE} bg-primary-container text-on-primary-container`}>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-[22px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
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
    <span className={`${ICON_CIRCLE} bg-error-container text-on-error-container`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[22px]" fill="none">
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
      footer={
        <Link to={continueTo} className="font-medium text-slate-900 underline hover:text-slate-600">
          {continueLabel}
        </Link>
      }
    >
      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        {verify.isPending || verify.isIdle ? (
          <p className="text-sm text-on-surface-variant">Підтверджуємо пошту…</p>
        ) : verify.isSuccess ? (
          <>
            <SuccessIcon />
            <p className="text-sm text-on-surface">
              Пошту підтверджено. Тепер можна створювати бронювання.
            </p>
          </>
        ) : (
          <>
            <ErrorIcon />
            <p className="text-sm text-on-surface">
              {verify.error instanceof ApiError
                ? verify.error.message
                : 'Не вдалося підтвердити пошту.'}
            </p>
            <p className="text-sm text-on-surface-variant">
              Увійдіть в акаунт і надішліть нове посилання.
            </p>
          </>
        )}
      </div>
    </AuthCard>
  );
}
