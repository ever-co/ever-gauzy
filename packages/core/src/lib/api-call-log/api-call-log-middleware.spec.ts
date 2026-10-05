import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { Request, Response } from 'express';

// Keep the unit under test isolated from the ORM layer: the entity is a plain bag of fields here and
// the service is a stub whose `create` call is asserted on.
jest.mock('./api-call-log.entity', () => ({
	ApiCallLog: class {
		constructor(input: Record<string, unknown>) {
			Object.assign(this, input);
		}
	}
}));
jest.mock('./api-call-log.service', () => ({ ApiCallLogService: class {} }));
jest.mock('../core/context', () => ({
	RequestContext: { getContextId: () => undefined, currentUserId: () => null }
}));

import { ApiCallLogMiddleware } from './api-call-log-middleware';
import { ApiCallLogService } from './api-call-log.service';

/** A response double that behaves like Node's: `end()` finishes it and emits `finish`. */
function createResponse(statusCode: number): Response {
	const res = new EventEmitter() as unknown as Response & EventEmitter;
	res.statusCode = statusCode;
	res.end = function (this: EventEmitter) {
		setImmediate(() => this.emit('finish'));
		return this;
	} as unknown as Response['end'];
	return res;
}

function createRequest(method: string, url: string, body: unknown, contentType?: string): Request {
	return {
		method,
		originalUrl: url,
		protocol: 'https',
		ip: '127.0.0.1',
		headers: {
			'tenant-id': '7d5a2c56-62a5-4f8a-9bf2-6a1a5c2b9f10',
			'organization-id': '0b9c7f43-55a0-4a8e-8f43-0d2d39a3e1a5',
			'user-agent': 'jest',
			authorization: 'Bearer not-a-real-token',
			cookie: 'session=not-a-real-session',
			...(contentType ? { 'content-type': contentType } : {})
		},
		body
	} as unknown as Request;
}

/** Runs one request through the middleware and returns the entity it asked the service to store. */
async function logCall(req: Request, statusCode: number, responseChunk?: string): Promise<Record<string, any>> {
	const create = jest.fn().mockResolvedValue(undefined);
	const middleware = new ApiCallLogMiddleware({ create } as unknown as ApiCallLogService);
	const res = createResponse(statusCode);

	await middleware.use(req, res, () => undefined);
	await new Promise<void>((resolve) => {
		res.on('finish', () => setImmediate(resolve));
		res.end(responseChunk);
	});

	expect(create).toHaveBeenCalledTimes(1);
	return create.mock.calls[0][0];
}

describe('ApiCallLogMiddleware', () => {
	// The middleware debug-logs every entity it stores; keep the test output readable.
	beforeAll(() => Logger.overrideLogger(false));

	it('logs an empty object, not null, when no body parser set req.body (multipart screenshot upload)', async () => {
		// Express 5 leaves req.body undefined for multipart requests: multer runs after this middleware.
		const req = createRequest('POST', '/api/timesheet/screenshot', undefined, 'multipart/form-data; boundary=x');

		const entity = await logCall(req, 201, '{"id":"screenshot-1"}');

		expect(entity.requestBody).toEqual({});
		expect(entity.url).toBe('/api/timesheet/screenshot');
		expect(entity.method).toBe('POST');
		expect(entity.statusCode).toBe(201);
		expect(entity.responseBody).toEqual({ id: 'screenshot-1' });
	});

	it('logs an empty object for a body-less DELETE', async () => {
		const req = createRequest('DELETE', '/api/timesheet/time-slot?ids[]=1', undefined);

		const entity = await logCall(req, 200, '{"affected":1}');

		expect(entity.requestBody).toEqual({});
		expect(entity.requestBody).not.toBeNull();
		// Credentials in the headers of these now-logged calls are not stored either.
		expect(entity.requestHeaders.authorization).toBe('[REDACTED]');
		expect(entity.requestHeaders.cookie).toBe('[REDACTED]');
	});

	it('keeps a parsed JSON body and still redacts its sensitive fields', async () => {
		const req = createRequest(
			'POST',
			'/api/timesheet/time-log',
			{ description: 'work', password: 'secret', nested: { token: 'abc' } },
			'application/json'
		);

		const entity = await logCall(req, 201, '{}');

		expect(entity.requestBody).toEqual({
			description: 'work',
			password: '[REDACTED]',
			nested: { token: '[REDACTED]' }
		});
		expect(entity.requestHeaders.authorization).toBe('[REDACTED]');
	});
});
