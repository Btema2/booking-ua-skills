import { BadRequestException, HttpStatus } from '@nestjs/common';
import { z } from 'zod';

type FieldErrors = Record<string, string[]>;

// Issues that carry no path (e.g. the body is not an object at all) land here,
// so a validation failure is never reported as an empty `errors` object.
const FORM_ERROR_KEY = '_form';

function toFieldErrors(error: z.ZodError): FieldErrors {
  return error.issues.reduce<FieldErrors>((errors, issue) => {
    const field = issue.path.length > 0 ? String(issue.path[0]) : FORM_ERROR_KEY;
    return { ...errors, [field]: [...(errors[field] ?? []), issue.message] };
  }, {});
}

/**
 * Parses a request payload, turning a Zod failure into the documented
 * `{ statusCode: 400, errors: { field: [message] } }` body so the client can
 * render each message under the field it belongs to.
 */
export function parseOrThrow<Schema extends z.ZodType>(schema: Schema, payload: unknown): z.output<Schema> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      errors: toFieldErrors(result.error),
    });
  }
  return result.data;
}
