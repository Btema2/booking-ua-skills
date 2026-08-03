// Single place that knows the wire format documented for /api: a 400 carries a
// per-field `errors` map, every other failure carries a single `message`.

const API_BASE = '/api';

const NETWORK_ERROR_MESSAGE = 'Не вдалося зʼєднатися із сервером. Перевірте підключення.';
const UNEXPECTED_ERROR_MESSAGE = 'Сталася непередбачена помилка. Спробуйте ще раз.';

/** Field name -> list of human-readable messages, as returned by a 400. */
export type FieldErrors = Readonly<Record<string, readonly string[]>>;

/**
 * Every non-2xx response and every transport failure surfaces as this error.
 * `fieldErrors` is non-null only when the server sent a per-field `errors` map,
 * which is what lets a caller decide between per-field and form-level display.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldErrors | null;

  constructor(status: number, message: string, fieldErrors: FieldErrors | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function toMessageList(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.filter((message): message is string => typeof message === 'string');
  }
  return typeof value === 'string' ? [value] : [];
}

function parseFieldErrors(value: unknown): FieldErrors | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([field, messages]) => [field, toMessageList(messages)] as const)
    .filter(([, messages]) => messages.length > 0);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function toApiError(status: number, body: unknown): ApiError {
  const payload = (typeof body === 'object' && body !== null ? body : {}) as {
    message?: unknown;
    errors?: unknown;
  };
  const message =
    typeof payload.message === 'string' && payload.message.length > 0
      ? payload.message
      : UNEXPECTED_ERROR_MESSAGE;
  return new ApiError(status, message, parseFieldErrors(payload.errors));
}

async function readJsonBody(response: { status: number; json: () => Promise<unknown> }) {
  // 204 (logout) has no body, and an error page may not be JSON at all.
  if (response.status === 204) {
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE);
  }

  const body = await readJsonBody(response);
  if (!response.ok) {
    throw toApiError(response.status, body);
  }
  return body as T;
}

export function postJson<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) });
}
