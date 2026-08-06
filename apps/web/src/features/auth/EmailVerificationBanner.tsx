import { useMutation } from '@tanstack/react-query';
import { resendVerificationToken } from './api';
import { useCurrentUser } from './useCurrentUser';

export interface EmailVerificationBannerProps {
  readonly highlighted?: boolean;
  readonly id?: string;
  readonly className?: string;
}

export function EmailVerificationBanner({
  highlighted = false,
  id = 'email-verification-banner',
  className = '',
}: EmailVerificationBannerProps) {
  const { data: user } = useCurrentUser();
  const resendMutation = useMutation({
    mutationFn: resendVerificationToken,
  });

  if (!user || user.emailVerifiedAt) {
    return null;
  }

  const baseStyles =
    'flex flex-wrap items-center justify-between gap-s3 rounded-lg border p-s4 text-body-medium transition-all duration-300';
  const stateStyles = highlighted
    ? 'border-primary bg-surface-container-high ring-2 ring-primary scale-[1.01]'
    : 'border-outline bg-surface-container text-on-surface';

  return (
    <div
      id={id}
      tabIndex={-1}
      role="region"
      aria-label="Підтвердження електронної пошти"
      className={`${baseStyles} ${stateStyles} ${className}`.trim()}
    >
      <div className="flex items-center gap-s3">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-[20px] shrink-0 text-primary"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="font-medium">
          Для створення бронювань необхідно підтвердити електронну пошту.
        </span>
      </div>

      <div>
        {resendMutation.isSuccess ? (
          <span className="font-semibold text-primary">
            Посилання надіслано! Перевірте консоль сервера
          </span>
        ) : (
          <button
            type="button"
            disabled={resendMutation.isPending}
            onClick={() => resendMutation.mutate()}
            className="cursor-pointer rounded-full border border-on-primary-container bg-on-primary-container px-s4 py-s2 text-label-medium font-semibold text-on-primary hover:bg-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary-container disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resendMutation.isPending ? 'Надіслано...' : 'Надіслати ще раз'}
          </button>
        )}
      </div>
    </div>
  );
}
