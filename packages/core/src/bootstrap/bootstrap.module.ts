import { MiddlewareConsumer, Module, NestModule, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, getConfig } from '@gauzy/config';
import { PluginModule } from '@gauzy/plugin';
import { Logger, LoggerModule } from '../logger';
import { AppModule } from './../app.module';
import tracer from './tracer';

@Module({
	imports: [
		ConfigModule,
		PluginModule.init(getConfig().plugins), // Import PluginModule first
		LoggerModule.forRoot(),
		AppModule
	]
})
export class BootstrapModule implements NestModule, OnApplicationBootstrap, OnApplicationShutdown {

	constructor() { }

	/**
	 *
	 * @param consumer
	 */
	configure(consumer: MiddlewareConsumer) {
		consumer.apply().forRoutes('*');
	}

	/**
	 * This method will be called after the application has fully started.
	 */
	async onApplicationBootstrap() {
		// Perform any initialization or setup logic here...
		console.log('Application has started. Performing additional setup...');
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
