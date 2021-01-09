// src/logger/logger.provider.ts

import { Provider } from '@nestjs/common';
import { prefixesForLoggers } from './logger.decorator';
import { Logger } from './logger';

function loggerFactory(logger: Logger, prefix: string) {
  if (prefix) {
    logger.setPrefix(prefix);
  }
  return logger;
}

function createLoggerProvider(prefix: string): Provider<Logger> {
  return {
    provide: `Logger${prefix}`,
    useFactory: (logger) => loggerFactory(logger, prefix),
    inject: [Logger],
  };
}

export function createLoggerProviders(): Array<Provider<Logger>> {
  return prefixesForLoggers.map((prefix) => createLoggerProvider(prefix));
}
