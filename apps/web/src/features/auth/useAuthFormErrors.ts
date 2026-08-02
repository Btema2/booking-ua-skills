import { useCallback, useState } from 'react';
import { describeAuthError } from './serverErrors';

/** Structurally compatible with react-hook-form's `setError`. */
type SetFieldError<TField extends string> = (
  field: TField,
  error: { type: string; message: string },
) => void;

/**
 * Shared failure handling for the login and register forms: per-field messages
 * go back onto the fields, everything else becomes one form-level message.
 * Nothing here touches the form values, so a failure never discards typing.
 */
export function useAuthFormErrors<TField extends string>(knownFields: readonly TField[]) {
  const [formError, setFormError] = useState<string | null>(null);

  const clearFormError = useCallback(() => setFormError(null), []);

  const reportFailure = useCallback(
    (error: unknown, setFieldError: SetFieldError<TField>) => {
      const report = describeAuthError(error, knownFields);
      report.fieldErrors.forEach(([field, message]) =>
        setFieldError(field, { type: 'server', message }),
      );
      setFormError(report.formError);
    },
    [knownFields],
  );

  return { formError, clearFormError, reportFailure };
}
