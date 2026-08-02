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
  const borderClass = error ? 'border-red-500' : 'border-slate-300';

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`mt-1 block w-full rounded-md border ${borderClass} bg-white px-3 py-2 text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-300`}
        {...registration}
      />
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
