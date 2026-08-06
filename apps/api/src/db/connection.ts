import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { loadEnv } from '../config/env';
import * as schema from './schema';

let pool: Pool | undefined;
let db: NodePgDatabase<typeof schema> | undefined;

export function getConnection(): { pool: Pool; db: NodePgDatabase<typeof schema> } {
  if (!pool || !db) {
    const env = loadEnv();
    if (env.TEST_DATABASE_URL) {
      pool = new Pool({ connectionString: env.TEST_DATABASE_URL });
    } else {
      pool = new Pool({
        host: env.POSTGRES_HOST,
        port: env.POSTGRES_PORT,
        user: env.POSTGRES_USER,
        password: env.POSTGRES_PASSWORD,
        database: env.POSTGRES_DB,
      });
    }
    db = drizzle(pool, { schema });
  }
  return { pool, db };
}

export async function closeConnection(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    db = undefined;
  }
}

