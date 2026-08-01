import { MODULE_METADATA } from '@nestjs/common/constants';
import { AppModule } from './app.module';
import { SpaController } from './static/spa.controller';

describe('AppModule', () => {
  it('registers SpaController last, since nest g controller appends new entries and its wildcard route would shadow anything after it', () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AppModule) as unknown[];
    expect(controllers[controllers.length - 1]).toBe(SpaController);
  });
});
