import { BOOKING_REJECTION_MESSAGES } from '@booking/core';
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
  let message: string | undefined;

  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
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
    if (typeof obj.message === 'string') {
      message = obj.message;
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
      formError: err instanceof ApiError ? err.message : BOOKING_REJECTION_MESSAGES.slotTaken,
    };
  }

  let unmappedFieldMessage: string | undefined;
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

    for (const [field, value] of Object.entries(errorsObj)) {
      if (field === 'title' || field === 'startsAt') continue;
      const msg = extractStringMessage(value);
      if (msg) {
        unmappedFieldMessage = msg;
        break;
      }
    }
  }

  const hasFieldErrors = fieldErrors.title !== undefined || fieldErrors.time !== undefined;

  let formError: string | null = null;
  if (!hasFieldErrors) {
    if (unmappedFieldMessage) {
      formError = unmappedFieldMessage;
    } else if (status === 403 && message) {
      formError = message;
    } else {
      formError = 'Бронювання не збережено';
    }
  }

  return {
    fieldErrors,
    formError,
  };
}
