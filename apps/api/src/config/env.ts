import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  POSTGRES_HOST: z.string().min(1).default('localhost'),
  POSTGRES_PORT: z.coerce.number().int().positive().max(65535).default(5432),
  POSTGRES_USER: z.string().min(1).default('booking'),
  POSTGRES_PASSWORD: z.string().min(1).default('booking'),
  POSTGRES_DB: z.string().min(1).default('booking'),
  // Adds the Secure flag to the session cookie; must be true when served over HTTPS.
  // Parsed as an explicit 'true' | 'false' literal because z.coerce.boolean() would
  // turn the string 'false' into true.
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  // No default: connection.ts branches on presence to pick test vs discrete
  // POSTGRES_* connection. A default here would make every runtime — dev,
  // prod, docker — look "test-configured" and silently connect to the wrong DB.
  TEST_DATABASE_URL: z.string().optional(),
  // How many minutes before a booking ends its author is notified, if the
  // room's next slot is already taken. Interpolated into the notification
  // text — never hardcoded there — per SPEC §7 Phase 8 item 2.
  NOTIFY_BEFORE_MINUTES: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Docker Compose substitutes an unset ${VAR} with an empty string rather than
  // leaving it out, and an empty string is not `undefined`, so every .default()
  // above would be skipped and the container would crash-loop on a clean clone.
  const provided = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const result = EnvSchema.safeParse(provided);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
