import { DynamicModule, Module } from '@nestjs/common';
import { createLoggerProviders } from './logger.provider';
import { Logger } from './logger';

@Module({})
export class LoggerModule {
  static forRoot(): DynamicModule {
    const prefixedLoggerProviders = createLoggerProviders();
    return {
      module: LoggerModule,
      providers: [Logger, ...prefixedLoggerProviders],
      exports: [Logger, ...prefixedLoggerProviders],
    };
  }
}
