import type { Config } from 'drizzle-kit';

export default {
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'booking',
    password: process.env.POSTGRES_PASSWORD ?? 'booking',
    database: process.env.POSTGRES_DB ?? 'booking',
  },
} satisfies Config;
