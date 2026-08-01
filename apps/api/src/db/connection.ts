import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { loadEnv } from '../config/env';
import * as schema from './schema';

const env = loadEnv();

export const pool = new Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DB,
});

export const db = drizzle(pool, { schema });
