import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { PUBLIC_DIR, SpaController } from './static/spa.controller';

// SpaController's wildcard route must stay LAST (Nest matches controllers in array order); see app.module.spec.ts.
@Module({
  imports: [AuthModule],
  controllers: [HealthController, AuthController, SpaController],
  providers: [{ provide: PUBLIC_DIR, useValue: join(__dirname, 'public') }],
})
export class AppModule {}
