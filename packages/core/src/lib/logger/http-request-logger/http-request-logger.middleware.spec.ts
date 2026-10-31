import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
	formatByteSize,
	formatHttpRequestLog,
	HttpRequestLoggerMiddleware,
	httpRequestLogLevel,
	isPathUnder
} from './http-request-logger.middleware';
import { resolveHttpRequestLoggerOptions } from './http-request-logger.options';

describe('HTTP request log helpers', () => {
	it('logs server errors as warnings and everything else as ordinary lines', () => {
		expect(httpRequestLogLevel(200)).toBe('log');
		expect(httpRequestLogLevel(304)).toBe('log');
		expect(httpRequestLogLevel(404)).toBe('log');
		expect(httpRequestLogLevel(500)).toBe('warn');
		expect(httpRequestLogLevel(503)).toBe('warn');
	});

	it('formats sizes', () => {
		expect(formatByteSize(512)).toBe('512B');
		expect(formatByteSize(1536)).toBe('1.5kB');
		expect(formatByteSize(5 * 1024 * 1024)).toBe('5.0MB');
	});

	it('formats a line with status, duration, size and request id', () => {
		expect(
			formatHttpRequestLog({
				method: 'GET',
				url: '/api/employee?page=1',
				statusCode: 200,
				durationMs: 12.345,
				contentLength: 1536,
				requestId: 'req-1'
			})
		).toBe('GET /api/employee?page=1 200 12.3ms 1.5kB [req-1]');
		expect(formatHttpRequestLog({ method: 'POST', url: '/api/x', statusCode: 201, durationMs: 3 })).toBe(
			'POST /api/x 201 3.0ms'
		);
	});

	it('formats an aborted request without a status', () => {
		expect(
			formatHttpRequestLog({
				method: 'GET',
				url: '/api/report',
				statusCode: 200,
				durationMs: 1500,
				aborted: true,
				contentLength: 10,
				requestId: 'req-2'
			})
		).toBe('GET /api/report aborted after 1500.0ms [req-2]');
	});

	it('matches ignored paths on whole segments', () => {
		expect(isPathUnder('/api/health', '/api/health')).toBe(true);
		expect(isPathUnder('/api/health/db', '/api/health')).toBe(true);
		expect(isPathUnder('/api/healthy', '/api/health')).toBe(false);
		expect(isPathUnder('/api/health/db', '/api/health/')).toBe(true);
	});
});

describe('HttpRequestLoggerMiddleware', () => {
	let lines: Array<{ level: 'log' | 'warn'; context: string; message: string }>;

	beforeEach(() => {
		lines = [];
		for (const level of ['log', 'warn'] as const) {
			jest.spyOn(Logger.prototype, level).mockImplementation(function (this: Logger, message: unknown) {
				lines.push({
					level,
					context: (this as unknown as { context: string }).context,
					message: String(message)
				});
			});
		}
	});

	afterEach(() => jest.restoreAllMocks());

	function middleware(overrides = {}) {
		return new HttpRequestLoggerMiddleware(resolveHttpRequestLoggerOptions({ enabled: true, ...overrides }, {}));
	}

	function fakeRequest({
		method = 'GET',
		originalUrl = '/api/employee?page=1',
		headers = {} as Record<string, string>,
		params = {} as Record<string, unknown>,
		statusCode = 200,
		responseHeaders = { 'content-length': '42', 'x-correlation-id': 'req-1' } as Record<string, string>
	} = {}) {
		const req = {
			method,
			originalUrl,
			url: originalUrl,
			headers,
			params,
			body: { password: 'hunter2' }
		} as unknown as Request;
		const res = Object.assign(new EventEmitter(), {
			statusCode,
			getHeader: (name: string) => responseHeaders[name.toLowerCase()]
		}) as unknown as Response;
		return { req, res };
	}

	it('logs one line once the response is finished, with status, duration, size and request id', () => {
		const { req, res } = fakeRequest();
		const next = jest.fn();

		middleware().use(req, res, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(lines).toEqual([]);

		res.emit('finish');
		res.emit('close');

		expect(lines).toHaveLength(1);
		expect(lines[0].level).toBe('log');
		expect(lines[0].context).toBe('HttpRequest');
		expect(lines[0].message).toMatch(/^GET \/api\/employee\?page=1 200 \d+\.\dms 42B \[req-1\]$/);
	});

	it('logs a server error as a warning', () => {
		const { req, res } = fakeRequest({ statusCode: 500 });

		middleware().use(req, res, jest.fn());
		res.emit('finish');

		expect(lines).toEqual([expect.objectContaining({ level: 'warn' })]);
	});

	it('logs a request the client abandoned', () => {
		const { req, res } = fakeRequest();

		middleware().use(req, res, jest.fn());
		res.emit('close');
		res.emit('finish');

		expect(lines).toHaveLength(1);
		expect(lines[0].message).toMatch(/^GET \/api\/employee\?page=1 aborted after \d+\.\dms \[req-1\]$/);
	});

	it('never writes headers or bodies, and redacts sensitive query and route parameters', () => {
		const { req, res } = fakeRequest({
			originalUrl: '/api/public/invoice/42/t0k3n?email=jane%40example.com&page=2',
			headers: { authorization: 'Bearer abc.def.ghi', cookie: 'sid=secret-cookie', 'x-api-key': 'key-123' },
			params: { id: '42', token: 't0k3n' }
		});

		middleware().use(req, res, jest.fn());
		res.emit('finish');

		const [line] = lines;
		expect(line.message).toContain('GET /api/public/invoice/42/[REDACTED]?email=[REDACTED]&page=2 200');
		for (const secret of ['t0k3n', 'jane', 'Bearer', 'abc.def.ghi', 'secret-cookie', 'key-123', 'hunter2']) {
			expect(line.message).not.toContain(secret);
		}
	});

	describe('a request no route matched, or one abandoned before routing', () => {
		// Built at run time: a long literal of this shape reads as a leaked secret to secret scanners.
		const opaque = 'f0e1d2c3'.repeat(4);

		it('has a long random-looking path segment redacted in its 404 line', () => {
			const { req, res } = fakeRequest({
				method: 'POST',
				originalUrl: `/api/public/invoice/42/${opaque}`,
				statusCode: 404
			});

			middleware().use(req, res, jest.fn());
			res.emit('finish');

			expect(lines[0].message).toContain('POST /api/public/invoice/42/[REDACTED] 404');
			expect(lines[0].message).not.toContain(opaque);
		});

		it('has it redacted when the client gives up while only a middleware wildcard has matched', () => {
			const { req, res } = fakeRequest({
				originalUrl: `/api/public/invoice/42/${opaque}`,
				params: { splat: ['public', 'invoice', '42', opaque] }
			});

			middleware().use(req, res, jest.fn());
			res.emit('close');

			expect(lines[0].message).toMatch(/^GET \/api\/public\/invoice\/42\/\[REDACTED\] aborted after /);
		});
	});

	it('redacts the extra parameter names it is configured with', () => {
		const { req, res } = fakeRequest({ originalUrl: '/api/contact?phone=555-0100' });

		middleware({ redactParameters: ['phone'] }).use(req, res, jest.fn());
		res.emit('finish');

		expect(lines[0].message).toContain('/api/contact?phone=[REDACTED]');
	});

	it('skips health checks without listening to the response', () => {
		const { req, res } = fakeRequest({ originalUrl: '/api/health/database?verbose=1' });
		const next = jest.fn();

		middleware().use(req, res, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(res.listenerCount('finish')).toBe(0);
	});

	it('follows the configured log levels (LOG_LEVEL)', () => {
		jest.spyOn(Logger, 'isLevelEnabled').mockImplementation((level) => level === 'warn');
		const ok = fakeRequest();
		const failed = fakeRequest({ statusCode: 502 });

		const instance = middleware();
		instance.use(ok.req, ok.res, jest.fn());
		instance.use(failed.req, failed.res, jest.fn());
		ok.res.emit('finish');
		failed.res.emit('finish');

		expect(lines).toEqual([expect.objectContaining({ level: 'warn', message: expect.stringContaining(' 502 ') })]);
	});

	it('omits the size and the request id when the response has none', () => {
		const { req, res } = fakeRequest({ responseHeaders: {} });

		middleware().use(req, res, jest.fn());
		res.emit('finish');

		expect(lines[0].message).toMatch(/^GET \/api\/employee\?page=1 200 \d+\.\dms$/);
	});
});
