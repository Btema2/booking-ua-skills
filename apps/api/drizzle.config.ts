import type { Config } from 'drizzle-kit';

// Docker Compose substitutes an unset ${VAR} with an empty string rather than
// leaving it out, and '' ?? default skips the fallback (only null/undefined
// do that) — same reasoning as the empty-string filter in src/config/env.ts.
function envOr(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

export default {
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    host: envOr('POSTGRES_HOST', 'localhost'),
    port: Number(envOr('POSTGRES_PORT', '5432')),
    user: envOr('POSTGRES_USER', 'booking'),
    password: envOr('POSTGRES_PASSWORD', 'booking'),
    database: envOr('POSTGRES_DB', 'booking'),
  },
} satisfies Config;
