import { DynamicModule, Module } from '@nestjs/common';
import { createLoggerProviders } from './logger.provider';
import { Logger } from './logger';

@Module({})
export class LoggerModule {
	/**
	 * Configures the Logger module for root.
	 * @returns {DynamicModule} The dynamically configured module.
	 */
	static forRoot(): DynamicModule {
		const prefixedLoggerProviders = createLoggerProviders();
		return {
			module: LoggerModule,
			providers: [Logger, ...prefixedLoggerProviders],
			exports: [Logger, ...prefixedLoggerProviders]
		};
	}
}
