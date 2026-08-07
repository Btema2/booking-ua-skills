/** Form-level failure banner: the single `message` of a 401/409, or a transport error. */
export function FormError({ message }: { message: string | null }) {
  if (message === null) {
    return null;
  }
  return (
    <p
      role="alert"
      className="rounded-2xl border border-[var(--color-error)]/20 bg-[var(--color-error-container)] px-4 py-3 text-body-medium font-medium text-[var(--color-on-error-container)] shadow-sm"
    >
      {message}
    </p>
  );
}

