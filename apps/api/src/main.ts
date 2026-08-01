import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { runMigrations } from './db/migrate';
import { seedRooms } from './db/seed';

async function bootstrap() {
  const env = loadEnv();
  await runMigrations();
  await seedRooms();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  await app.listen(env.PORT);
}

bootstrap().catch((error) => {
  console.error('Failed to start application', error);
  process.exitCode = 1;
});
