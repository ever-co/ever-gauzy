import tracer from './tracer';
import { MiddlewareConsumer, Module, NestModule, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule } from '@gauzy/config';
import { PluginModule } from '@gauzy/plugin';
import { AppModule } from './../app.module';
import { Logger, LoggerModule } from '../logger';

@Module({
	imports: [
		ConfigModule,
		LoggerModule.forRoot(),
		PluginModule.init(),
		AppModule
	]
})
export class BootstrapModule implements NestModule, OnApplicationShutdown {

	constructor() { }

	/**
	 *
	 * @param consumer
	 */
	configure(consumer: MiddlewareConsumer) {
		consumer.apply().forRoutes('*');
	}

	/**
	 *
	 * @param signal
	 */
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
