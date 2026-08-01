import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PUBLIC_DIR, SpaController } from './static/spa.controller';

@Module({
  controllers: [HealthController, SpaController],
  providers: [{ provide: PUBLIC_DIR, useValue: join(__dirname, 'public') }],
})
export class AppModule {}
