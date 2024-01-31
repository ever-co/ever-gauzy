import tracer from './tracer';
import { MiddlewareConsumer, Module, NestModule, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, getConfig } from '@gauzy/config';
import { PluginModule } from '@gauzy/plugin';
import { AppModule } from './../app.module';
import { Logger, LoggerModule } from '../logger';
import { HealthModule } from '../health/health.module';
import { SharedModule } from '../shared/shared.module';

@Module({
	imports: [
		ConfigModule,
		LoggerModule.forRoot(),
		PluginModule.forRoot(getConfig()),
		AppModule,
		HealthModule,
		SharedModule
	]
})
export class BootstrapModule implements NestModule, OnApplicationShutdown {
	constructor() { }

	configure(consumer: MiddlewareConsumer) {
		consumer.apply().forRoutes('*');
	}

	async onApplicationShutdown(signal: string) {
		if (signal) {
			Logger.log(`Received shutdown signal: ${signal}`);

			if (signal === 'SIGTERM') {
				Logger.log('SIGTERM shutting down. Please wait...');

				if (process.env.OTEL_ENABLED === 'true') {
					try {
						await tracer.shutdown();
					} catch (error) {
						console.log('Error terminating tracing', error);
					}
				}
			}
		}
	}
}
