import type { UseFormRegisterReturn } from 'react-hook-form';

type TextFieldProps = {
  label: string;
  type: 'text' | 'email' | 'password';
  autoComplete: string;
  /** Message for this field, from client validation or from a server 400. */
  error?: string;
  registration: UseFormRegisterReturn;
};

export function TextField({ label, type, autoComplete, error, registration }: TextFieldProps) {
  // Only one auth form is mounted at a time, so the field name is a stable
  // unique id — and deriving it guarantees the label always points at the input.
  const id = registration.name;
  const errorId = `${id}-error`;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-label-medium font-bold text-[var(--color-on-surface-variant)]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        placeholder={
          type === 'email'
            ? "ім'я@example.com"
            : type === 'password'
            ? 'Мінімум 8 символів'
            : ''
        }
        className={`w-full rounded-full bg-[var(--auth-well-bg)] border border-[rgba(120,78,40,.22)] shadow-[var(--auth-well-shadow)] min-h-[var(--auth-well-min-h)] px-5 py-3 text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] text-body-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 focus:border-[var(--color-primary)] transition-all ${
          error ? 'border-2 border-[var(--color-error)] text-[var(--color-error)]' : ''
        }`}
        {...registration}
      />
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-body-small text-[var(--color-error)] font-medium px-3">
          {error}
        </p>
      ) : null}
    </div>
  );
}

