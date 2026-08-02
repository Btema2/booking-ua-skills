/**
 * drizzle-orm reports every driver failure as a `DrizzleQueryError`, whose
 * `message` and `params` both embed the bound query parameters. On the `users`
 * insert those parameters include the bcrypt password hash, so letting one reach
 * a logger or Nest's default exception filter writes offline-crackable material
 * to stdout. The driver's own error — and with it the SQLSTATE — is one level
 * down on `cause`, so matching `code` on the wrapper silently never fires.
 *
 * Repositories therefore run every query through `runQuery`, which replaces the
 * driver error with a redacted one. The original stack is dropped on purpose:
 * its first line is the message, which is exactly what must not be logged.
 */

export const UNIQUE_VIOLATION = '23505';

interface DriverErrorFields {
  code?: unknown;
  constraint?: unknown;
  cause?: unknown;
}

/**
 * Walks the `cause` chain for the innermost error carrying a `code`. Covers both
 * Postgres SQLSTATEs and Node system codes such as `ECONNREFUSED`.
 */
function describeDriverError(error: unknown): { code?: string; constraint?: string } {
  for (let current = error; typeof current === 'object' && current !== null; current = (current as DriverErrorFields).cause) {
    const { code, constraint } = current as DriverErrorFields;
    if (typeof code === 'string') {
      return { code, constraint: typeof constraint === 'string' ? constraint : undefined };
    }
  }
  return {};
}

/** Redacted stand-in for a driver error: carries the code, never the parameters. */
export class QueryFailedError extends Error {
  constructor(
    readonly operation: string,
    readonly code?: string,
    readonly constraint?: string,
  ) {
    const detail = [code && `code ${code}`, constraint && `constraint ${constraint}`].filter(Boolean).join(', ');
    super(`Query failed during ${operation}${detail ? ` (${detail})` : ''}`);
    this.name = 'QueryFailedError';
  }
}

/** Runs a query, translating any driver failure into a `QueryFailedError`. */
export async function runQuery<T>(operation: string, query: () => Promise<T>): Promise<T> {
  try {
    return await query();
  } catch (error) {
    const { code, constraint } = describeDriverError(error);
    throw new QueryFailedError(operation, code, constraint);
  }
}
