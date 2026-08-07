import type { ReactNode } from 'react';
import { Link } from 'react-router';

type AuthCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Cross-link to the other auth screen. */
  footer: ReactNode;
};

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <main
      className="relative flex min-h-screen w-full items-center justify-center p-4 sm:p-6 lg:p-8 overflow-x-hidden"
      style={{
        backgroundImage: `
          var(--auth-wood-vignette),
          var(--auth-wood-glow),
          var(--auth-wood-grain-a),
          var(--auth-wood-grain-b),
          var(--auth-wood-desk)
        `,
        backgroundBlendMode: 'normal, normal, var(--auth-wood-grain-blend), var(--auth-wood-grain-blend), normal',
        backgroundPosition: 'center center',
        backgroundSize: 'cover',
      }}
    >
      <section
        className="relative w-full max-w-[960px] overflow-hidden rounded-[var(--auth-ceramic-radius-mobile)] sm:rounded-[var(--auth-ceramic-radius)] p-[var(--auth-ceramic-pad-mobile)] sm:p-[var(--auth-ceramic-pad)]"
        style={{
          background: 'var(--auth-ceramic-face)',
          boxShadow: 'var(--auth-ceramic-rim), var(--auth-ceramic-lift)',
        }}
      >
        {/* Inner glaze highlight */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[var(--auth-ceramic-glaze-h)] rounded-[var(--auth-ceramic-glaze-radius)]"
          style={{ background: 'var(--auth-ceramic-glaze)' }}
          aria-hidden="true"
        />

        <div className="relative z-10 grid grid-cols-1 min-[761px]:grid-cols-[minmax(0,1fr)_1px_minmax(0,380px)] min-[761px]:gap-x-14 gap-y-8 items-stretch">
          {/* Left Column: Branding & Info */}
          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div
                className="flex size-[var(--auth-mark-size)] items-center justify-center rounded-full shadow-[var(--auth-mark-shadow)] text-[var(--auth-mark-ink)] font-heading font-extrabold text-2xl tracking-wide"
                style={{ background: 'var(--auth-mark-face)' }}
              >
                П
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#a85f2e]">
                  ПЕРЕГОВОРНІ
                </p>
                <h1 className="mt-1 font-heading text-[clamp(28px,5vw,44px)] font-extrabold leading-[1.06] text-[var(--color-on-surface)]">
                  {title}
                </h1>
                <p className="mt-2 font-body text-body-medium text-[var(--color-on-surface-variant)]">
                  {subtitle ?? 'Увійдіть, щоб побачити розклад переговорних.'}
                </p>
              </div>
            </div>

            <div className="border-t border-[rgba(120,78,40,.14)] pt-4 text-body-small text-[var(--color-on-surface-variant)]/80 space-y-1">
              <p>Дуб · Ясен · Липа · Верба · Сосна · Клен</p>
              <p>2–4 поверхи · 09:00–19:00 за київським часом</p>
            </div>
          </div>

          {/* Center Divider Line */}
          <div
            className="hidden min-[761px]:block w-[1px] h-full"
            style={{ background: 'var(--auth-divider)' }}
            aria-hidden="true"
          />

          {/* Right Column: Form and Actions */}
          <div className="flex flex-col justify-center">
            {children}
            <div className="mt-6 text-center text-body-medium">{footer}</div>
          </div>
        </div>
      </section>
    </main>
  );
}

export function AuthFooterLink({ question, to, label }: {
  question: string;
  to: string;
  label: string;
}) {
  return (
    <p className="text-body-medium text-[var(--color-on-surface-variant)]">
      {question}{' '}
      <Link
        to={to}
        className="font-bold text-[var(--color-on-primary-container)] underline hover:opacity-80 transition-opacity"
      >
        {label}
      </Link>
    </p>
  );
}

export function AuthSubmitButton({ pending, label, pendingLabel }: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      style={{ background: 'var(--auth-glaze-primary)' }}
      className="w-full rounded-full shadow-[var(--auth-glaze-primary-shadow)] text-[var(--auth-glaze-primary-ink)] min-h-[var(--auth-glaze-primary-min-h)] px-6 py-3 text-label-large font-semibold hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}


