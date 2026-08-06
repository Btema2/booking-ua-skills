import { Client } from 'pg';
import { sql } from 'drizzle-orm';
import { loadEnv } from '../src/config/env';
import { getConnection, closeConnection } from '../src/db/connection';
import { runMigrations } from '../src/db/migrate';
import { seedRooms } from '../src/db/seed';

// env.ts leaves TEST_DATABASE_URL undefined unless explicitly set, so a runtime
// default lives here — test-harness-only, never affects app connection.ts.
const DEFAULT_TEST_DATABASE_URL = 'postgres://booking:booking@localhost:5433/booking_test';

export async function setupTestDb(): Promise<void> {
  const env = loadEnv();
  const testDbUrl = env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL;

  // Force process.env.TEST_DATABASE_URL so a later loadEnv() (inside
  // getConnection()) picks it up and connects to the test database.
  process.env.TEST_DATABASE_URL = testDbUrl;

  // Connect to postgres maintenance DB to ensure test database exists
  try {
    const urlObj = new URL(testDbUrl);
    const dbName = urlObj.pathname.slice(1);
    urlObj.pathname = `/${env.POSTGRES_DB || 'booking'}`;
    const adminUrl = urlObj.toString();
    const adminClient = new Client({ connectionString: adminUrl });
    await adminClient.connect();
    const res = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (res.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
    }
    await adminClient.end();
  } catch (error) {
    console.error('Failed to create test database:', error);
  }

  // Ensure connection pool is reset if previously initialized
  await closeConnection();

  // Run programmatic migrations against test database
  await runMigrations();

  // Seed rooms into test database
  await seedRooms();
}

export async function truncateTables(): Promise<void> {
  const { db } = getConnection();
  await db.execute(
    sql`TRUNCATE TABLE bookings, users, sessions, email_verification_tokens, notifications RESTART IDENTITY CASCADE;`,
  );
}
