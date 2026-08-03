import { join } from 'node:path';
import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { HealthController } from './health/health.controller';
import { RoomsModule } from './rooms/rooms.module';
import { PUBLIC_DIR } from './static/public-dir';
import { SpaFallbackMiddleware } from './static/spa-fallback.middleware';

@Module({
  imports: [AuthModule, RoomsModule, BookingsModule],
  controllers: [HealthController],
  providers: [{ provide: PUBLIC_DIR, useValue: join(__dirname, 'public') }],
})
export class AppModule implements NestModule {
  // The SPA fallback runs as middleware, so it holds no route and controller order is
  // irrelevant — see the rationale on SpaFallbackMiddleware and app.module.spec.ts.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SpaFallbackMiddleware).forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}
