import { ApiError } from '../../lib/api';

export type FormErrorMappingResult = {
  fieldErrors: {
    title?: string;
    time?: string;
  };
  formError: string | null;
};



function extractStringMessage(val: unknown): string | undefined {
  if (typeof val === 'string' && val.length > 0) {
    return val;
  }
  if (Array.isArray(val)) {
    for (const item of val) {
      if (typeof item === 'string' && item.length > 0) {
        return item;
      }
    }
  }
  return undefined;
}

export function mapApiErrorToForm(err: unknown): FormErrorMappingResult {
  const fieldErrors: { title?: string; time?: string } = {};

  let status: number | undefined;
  let errorsObj: Record<string, unknown> | null = null;

  if (err instanceof ApiError) {
    status = err.status;
    if (err.fieldErrors) {
      errorsObj = err.fieldErrors as Record<string, unknown>;
    }
  } else if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    if (typeof obj.status === 'number') {
      status = obj.status;
    } else if (typeof obj.statusCode === 'number') {
      status = obj.statusCode;
    }

    if (typeof obj.fieldErrors === 'object' && obj.fieldErrors !== null) {
      errorsObj = obj.fieldErrors as Record<string, unknown>;
    } else if (typeof obj.errors === 'object' && obj.errors !== null) {
      errorsObj = obj.errors as Record<string, unknown>;
    }
  }

  if (status === 409) {
    return {
      fieldErrors: {},
      formError: 'Слот зайнятий',
    };
  }

  if (errorsObj) {
    if ('title' in errorsObj) {
      const msg = extractStringMessage(errorsObj.title);
      if (msg) {
        fieldErrors.title = msg;
      }
    }

    if ('startsAt' in errorsObj) {
      const msg = extractStringMessage(errorsObj.startsAt);
      if (msg) {
        fieldErrors.time = msg;
      }
    }
  }

  const hasFieldErrors = fieldErrors.title !== undefined || fieldErrors.time !== undefined;
  const formError = hasFieldErrors ? null : 'Бронювання не збережено';

  return {
    fieldErrors,
    formError,
  };
}
