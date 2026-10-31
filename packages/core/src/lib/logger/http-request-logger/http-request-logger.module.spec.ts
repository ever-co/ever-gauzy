import {
	Controller,
	Get,
	INestApplication,
	InternalServerErrorException,
	Logger,
	MiddlewareConsumer,
	Param
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { HttpRequestLoggerModule } from './http-request-logger.module';
import { HttpRequestLoggerMiddleware } from './http-request-logger.middleware';
import { HTTP_REQUEST_LOGGER_OPTIONS, resolveHttpRequestLoggerOptions } from './http-request-logger.options';

@Controller()
class SampleController {
	@Get('employee/:id')
	employee(@Param('id') id: string) {
		return { id };
	}

	@Get('public/invoice/:id/:token')
	invoice(@Param('id') id: string) {
		return { id };
	}

	@Get('health')
	health() {
		return { status: 'ok' };
	}

	@Get('boom')
	boom() {
		throw new InternalServerErrorException();
	}
}

describe('resolveHttpRequestLoggerOptions', () => {
	it('is off by default and on with LOG_HTTP_REQUESTS=true', () => {
		expect(resolveHttpRequestLoggerOptions({}, {}).enabled).toBe(false);
		expect(resolveHttpRequestLoggerOptions({}, { LOG_HTTP_REQUESTS: 'false' }).enabled).toBe(false);
		expect(resolveHttpRequestLoggerOptions({}, { LOG_HTTP_REQUESTS: 'true' }).enabled).toBe(true);
	});

	it('lets explicit options win over the environment and the defaults, ignoring undefined ones', () => {
		expect(
			resolveHttpRequestLoggerOptions(
				{ enabled: false, context: 'Http', ignorePaths: undefined },
				{ LOG_HTTP_REQUESTS: 'true' }
			)
		).toEqual({
			enabled: false,
			context: 'Http',
			ignorePaths: ['/api/health'],
			redactParameters: [],
			requestIdHeader: 'x-correlation-id'
		});
	});
});

describe('HttpRequestLoggerModule', () => {
	let messages: string[];

	beforeEach(() => {
		messages = [];
		for (const level of ['log', 'warn'] as const) {
			jest.spyOn(Logger.prototype, level).mockImplementation(function (this: Logger, message: unknown) {
				if ((this as unknown as { context?: string }).context === 'HttpRequest') {
					messages.push(String(message));
				}
			});
		}
	});

	afterEach(() => jest.restoreAllMocks());

	it('registers no middleware at all while it is disabled', () => {
		const consumer = { apply: jest.fn() };

		new HttpRequestLoggerModule(resolveHttpRequestLoggerOptions({}, {})).configure(
			consumer as unknown as MiddlewareConsumer
		);

		expect(consumer.apply).not.toHaveBeenCalled();
	});

	it('registers the middleware for every route when it is enabled', () => {
		const forRoutes = jest.fn();
		const consumer = { apply: jest.fn(() => ({ forRoutes })) };

		new HttpRequestLoggerModule(resolveHttpRequestLoggerOptions({ enabled: true }, {})).configure(
			consumer as unknown as MiddlewareConsumer
		);

		expect(consumer.apply).toHaveBeenCalledWith(HttpRequestLoggerMiddleware);
		expect(forRoutes).toHaveBeenCalledWith('{*splat}');
	});

	it('resolves LOG_HTTP_REQUESTS when the application is created, not when forRoot() is called', async () => {
		const previous = process.env.LOG_HTTP_REQUESTS;
		try {
			delete process.env.LOG_HTTP_REQUESTS;
			const dynamicModule = HttpRequestLoggerModule.forRoot();
			process.env.LOG_HTTP_REQUESTS = 'true';

			const moduleRef = await Test.createTestingModule({ imports: [dynamicModule] }).compile();

			expect(moduleRef.get(HTTP_REQUEST_LOGGER_OPTIONS).enabled).toBe(true);
			await moduleRef.close();
		} finally {
			if (previous === undefined) {
				delete process.env.LOG_HTTP_REQUESTS;
			} else {
				process.env.LOG_HTTP_REQUESTS = previous;
			}
		}
	});

	describe('in a running application', () => {
		let app: INestApplication;

		/** The response is sent before `finish` fires on the server; give the event loop a turn. */
		async function settle(): Promise<void> {
			await new Promise((resolve) => setImmediate(resolve));
		}

		async function createApp(enabled: boolean): Promise<INestApplication> {
			const moduleRef = await Test.createTestingModule({
				imports: [HttpRequestLoggerModule.forRoot({ enabled })],
				controllers: [SampleController]
			}).compile();
			// The testing module's own logger stays in place: `logger: false` would also switch every level off.
			const instance = moduleRef.createNestApplication();
			instance.use((_req, res, next) => {
				res.setHeader('x-correlation-id', 'corr-1');
				next();
			});
			instance.setGlobalPrefix('api');
			await instance.init();
			return instance;
		}

		/** The lines about requests, without the one announcing that the log is on. */
		function requestLines(): string[] {
			return messages.filter((message) => !message.startsWith('HTTP request logging is on'));
		}

		afterEach(() => app?.close());

		it('announces itself once when the application starts', async () => {
			app = await createApp(true);

			expect(messages).toEqual([expect.stringContaining('HTTP request logging is on (LOG_HTTP_REQUESTS)')]);
		});

		it('logs method, path, status, duration, size and request id', async () => {
			app = await createApp(true);

			await request(app.getHttpServer()).get('/api/employee/7?page=2').expect(200);
			await settle();

			expect(requestLines()).toHaveLength(1);
			expect(requestLines()[0]).toMatch(/^GET \/api\/employee\/7\?page=2 200 \d+\.\dms \d+B \[corr-1\]$/);
		});

		it('redacts a token route parameter and never writes the Authorization header', async () => {
			app = await createApp(true);

			await request(app.getHttpServer())
				.get('/api/public/invoice/42/s3cr3t?token=q-s3cr3t')
				.set('Authorization', 'Bearer header-s3cr3t')
				.set('Cookie', 'sid=cookie-s3cr3t')
				.expect(200);
			await settle();

			expect(requestLines()).toHaveLength(1);
			expect(requestLines()[0]).toContain('GET /api/public/invoice/42/[REDACTED]?token=[REDACTED] 200');
			for (const message of messages) {
				expect(message).not.toContain('s3cr3t');
			}
		});

		it('redacts a random-looking token sent with a method no route takes, and keeps ids a route matched', async () => {
			// Built at run time: a long literal of this shape reads as a leaked secret to secret scanners.
			const opaque = '9e8d7c6b'.repeat(4);
			app = await createApp(true);

			await request(app.getHttpServer()).post(`/api/public/invoice/42/${opaque}`).expect(404);
			await request(app.getHttpServer()).get(`/api/employee/${opaque}`).expect(200);
			await settle();

			expect(requestLines()).toEqual([
				expect.stringMatching(/^POST \/api\/public\/invoice\/42\/\[REDACTED\] 404 /),
				expect.stringMatching(new RegExp(`^GET /api/employee/${opaque} 200 `))
			]);
		});

		it('logs a server error and skips health checks', async () => {
			app = await createApp(true);

			await request(app.getHttpServer()).get('/api/health').expect(200);
			await request(app.getHttpServer()).get('/api/boom').expect(500);
			await settle();

			expect(requestLines()).toEqual([expect.stringMatching(/^GET \/api\/boom 500 /)]);
		});

		it('writes nothing when disabled', async () => {
			app = await createApp(false);

			await request(app.getHttpServer()).get('/api/employee/7').expect(200);
			await settle();

			expect(messages).toEqual([]);
		});
	});
});
