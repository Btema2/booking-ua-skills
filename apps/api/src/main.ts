import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { runMigrations } from './db/migrate';
import { seedDemoData } from './db/seed';

async function bootstrap() {
  const env = loadEnv();
  await runMigrations();
  await seedDemoData();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // AuthGuard reads the session cookie off request.cookies, which cookie-parser fills.
  app.use(cookieParser());
  await app.listen(env.PORT);
}

bootstrap().catch((error) => {
  console.error('Failed to start application', error);
  process.exitCode = 1;
});
