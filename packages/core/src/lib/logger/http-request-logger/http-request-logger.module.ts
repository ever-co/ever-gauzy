import { DynamicModule, Inject, Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HttpRequestLoggerMiddleware } from './http-request-logger.middleware';
import {
	HTTP_REQUEST_LOGGER_OPTIONS,
	HttpRequestLoggerOptions,
	resolveHttpRequestLoggerOptions
} from './http-request-logger.options';

/**
 * The HTTP request log (#4006): one line per request with its method, URL (sensitive parameters redacted), status,
 * duration, response size and request id, for developers who want to see what the API is being asked.
 *
 * Off unless `LOG_HTTP_REQUESTS=true`; while it is off no middleware is registered at all, so a deployment that
 * does not ask for it runs exactly as before. Any Nest application can import it; `forRoot()` takes the same
 * options the environment provides, for an application that wants other defaults.
 *
 * Covers the routes under the global prefix (`/api/*`); health checks are skipped by default.
 */
@Module({})
export class HttpRequestLoggerModule implements NestModule {
	constructor(@Inject(HTTP_REQUEST_LOGGER_OPTIONS) private readonly options: HttpRequestLoggerOptions) {}

	/**
	 * @param overrides - Options that take precedence over `LOG_HTTP_REQUESTS` and the defaults.
	 */
	static forRoot(overrides: Partial<HttpRequestLoggerOptions> = {}): DynamicModule {
		return {
			module: HttpRequestLoggerModule,
			providers: [
				// Resolved when the application is created, after the environment files are loaded.
				{ provide: HTTP_REQUEST_LOGGER_OPTIONS, useFactory: () => resolveHttpRequestLoggerOptions(overrides) },
				HttpRequestLoggerMiddleware
			]
		};
	}

	configure(consumer: MiddlewareConsumer): void {
		if (!this.options.enabled) {
			return;
		}
		consumer.apply(HttpRequestLoggerMiddleware).forRoutes('{*splat}');
		new Logger(this.options.context).log(
			'HTTP request logging is on (LOG_HTTP_REQUESTS): one line per request, sensitive parameters redacted.'
		);
	}
}
