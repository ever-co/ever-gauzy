import { DatabaseModule } from './database.module';
import { DynamicModule, Module } from '@nestjs/common';

import { Helpers } from './helpers';
import { Services } from './services';

@Module({
  imports: [],
  providers: [...Services, ...Helpers],
  exports: [...Services, ...Helpers],
})
export class CoreModule {}

@Module({
  imports: [CoreModule],
  exports: [CoreModule],
})
export class ServiceModule {
  static forRoot(): DynamicModule {
    const { imports } = DatabaseModule.forRoot();
    return {
      module: ServiceModule,
      imports,
    } as DynamicModule;
  }
}
