import { ApiError } from '../../lib/api';

const FALLBACK_MESSAGE = 'Не вдалося виконати запит. Спробуйте ще раз.';

export type AuthErrorReport<TField extends string> = {
  /** Pairs ready to hand to react-hook-form's `setError`. */
  readonly fieldErrors: ReadonlyArray<readonly [TField, string]>;
  /** Shown above the form: a 401/409 message, or an error for an unknown field. */
  readonly formError: string | null;
};

/**
 * Splits a rejected auth request into per-field messages and one form-level
 * message. Messages the server attached to a field the form does not render
 * would otherwise vanish, so they are promoted to the form level.
 */
export function describeAuthError<TField extends string>(
  error: unknown,
  knownFields: readonly TField[],
): AuthErrorReport<TField> {
  if (!(error instanceof ApiError)) {
    return { fieldErrors: [], formError: FALLBACK_MESSAGE };
  }
  if (error.fieldErrors === null) {
    return { fieldErrors: [], formError: error.message };
  }

  const isKnown = (field: string): field is TField =>
    (knownFields as readonly string[]).includes(field);

  const firstMessages = Object.entries(error.fieldErrors)
    .map(([field, messages]) => [field, messages[0]] as const)
    .filter((entry): entry is readonly [string, string] => entry[1] !== undefined);

  return {
    fieldErrors: firstMessages
      .filter(([field]) => isKnown(field))
      .map(([field, message]) => [field as TField, message] as const),
    formError: firstMessages.find(([field]) => !isKnown(field))?.[1] ?? null,
  };
}
