import type { ReactNode } from 'react';
import { Link } from 'react-router';

type AuthCardProps = {
  title: string;
  children: ReactNode;
  /** Cross-link to the other auth screen. */
  footer: ReactNode;
};

export function AuthCard({ title, children, footer }: AuthCardProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {children}
        <div className="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-600">{footer}</div>
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
    <p>
      {question}{' '}
      <Link to={to} className="font-medium text-slate-900 underline hover:text-slate-600">
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
      className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:ring-2 focus:ring-slate-400 focus:outline-none disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
