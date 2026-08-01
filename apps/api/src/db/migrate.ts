import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './connection';

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
}

if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch((error: unknown) => {
      console.error('Migration failed', error);
      process.exitCode = 1;
    });
}
