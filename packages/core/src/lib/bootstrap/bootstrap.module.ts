import { MiddlewareConsumer, Module, NestModule, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule } from '@gauzy/config';
import { PluginModule } from '@gauzy/plugin';
import { AppModule } from '../app/app.module';
import { Logger, LoggerModule } from '../logger';

@Module({
	imports: [ConfigModule, LoggerModule.forRoot(), PluginModule.init(), AppModule]
})
export class BootstrapModule implements NestModule, OnApplicationShutdown {
	/**
	 * Configures middleware for the application.
	 * This method applies middleware to all routes in the application.
	 *
	 * @param consumer - An instance of `MiddlewareConsumer` that allows configuring middleware in the app.
	 */
	configure(consumer: MiddlewareConsumer) {
		consumer.apply().forRoutes('*');
	}


	/**
	 * Handles cleanup and resource shutdown logic when the application receives a termination signal.
	 * This method dynamically shuts down tracing if enabled and logs the shutdown process.
	 *
	 * @param signal - The signal causing the application shutdown (e.g., SIGTERM).
	 */
	async onApplicationShutdown(signal: string) {
		if (signal) {
			Logger.log(`Received shutdown signal: ${signal}`);

			// Check if tracing is enabled through the environment variable
			if (process.env.OTEL_ENABLED === 'true') {
				try {
					// Dynamically import the tracer module to ensure clean initialization/shutdown
					const { default: tracer } = await import('./tracer');
					if (tracer) {
						await tracer.shutdown(); // Shutdown the tracer
					}
				} catch (error) {
					console.error('Error terminating tracing', error);
				}
			}

			// Handle specific signal logic
			if (signal === 'SIGTERM') {
				Logger.log('SIGTERM shutting down. Please wait...');
			}
		}
	}
}
