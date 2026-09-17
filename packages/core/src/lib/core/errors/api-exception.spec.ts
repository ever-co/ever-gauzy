import { HttpException } from '@nestjs/common';
import { ApiErrorCode } from './api-error-codes';
import { toApiErrorBody } from './api-error-body';
import { ApiException, reasonPhrase } from './api-exception';
import { toSafeHttpException } from '../interceptors/safe-http-exception';

/**
 * The envelope is the one thing every client parses, so the rules that make it additive are
 * asserted one at a time: the three original keys keep their exact values, the added keys are the
 * five the contract names, and an exception that carries no details does not grow an empty one.
 */
describe('ApiException', () => {
	const conflict = new ApiException(409, ApiErrorCode.ENTITY_VERSION_CONFLICT, 'The order was modified by another request.', {
		expectedVersion: 3,
		actualVersion: 4
	});

	it('carries the status it was given', () => {
		expect(conflict.getStatus()).toBe(409);
	});

	it('carries the current three-key Nest body, so it is safe before the filter runs', () => {
		expect(conflict.getResponse()).toEqual({
			statusCode: 409,
			error: 'Conflict',
			message: 'The order was modified by another request.'
		});
	});

	it('names the reason phrase exactly as Nest does for the same status', () => {
		expect(conflict.getResponse()).toMatchObject({ error: reasonPhrase(409) });
		expect(reasonPhrase(400)).toBe('Bad Request');
		expect(reasonPhrase(404)).toBe('Not Found');
		expect(reasonPhrase(429)).toBe('Too Many Requests');
		expect(reasonPhrase(999)).toBe('Error');
	});

	it('carries the code and the details', () => {
		expect(conflict.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		expect(conflict.details).toEqual({ expectedVersion: 3, actualVersion: 4 });
	});

	it('is an HttpException, so every existing filter path still applies', () => {
		expect(conflict).toBeInstanceOf(HttpException);
		expect(conflict).toBeInstanceOf(Error);
	});

	it('adds no details key when none were supplied', () => {
		const bare = new ApiException(404, ApiErrorCode.RESOURCE_NOT_FOUND, 'Role could not be found.');
		expect(bare.details).toBeUndefined();
		expect(toApiErrorBody(bare, { url: '/api/roles' }, 'trace-1')).not.toHaveProperty('details');
	});
});

describe('an ApiException through the response interceptor', () => {
	/**
	 * `TransformInterceptor.catchError` runs BEFORE the filter chain and normalises everything
	 * through `toSafeHttpException`. If that ever cloned the body, the filter would stop recognising
	 * the exception and the envelope would silently disappear — this is the assertion that fails
	 * when it does.
	 */
	const exception = new ApiException(409, ApiErrorCode.ENTITY_VERSION_CONFLICT, 'conflict', { expectedVersion: 3 });

	it('survives with its identity, its code and its details intact', () => {
		const safe = toSafeHttpException(exception);

		expect(safe).toBe(exception);
		expect(safe).toBeInstanceOf(ApiException);
		expect((safe as ApiException).code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		expect((safe as ApiException).details).toEqual({ expectedVersion: 3 });
	});

	it('keeps the body byte-identical', () => {
		expect(JSON.stringify(toSafeHttpException(exception).getResponse())).toBe(
			JSON.stringify(exception.getResponse())
		);
	});
});

describe('toApiErrorBody', () => {
	const request = { method: 'GET', url: '/api/roles/1?fields=id', originalUrl: '/api/roles/1?fields=id' };
	const exception = new ApiException(409, ApiErrorCode.ENTITY_VERSION_CONFLICT, 'conflict', { expectedVersion: 3 });

	it('renders exactly the contract keys', () => {
		expect(Object.keys(toApiErrorBody(exception, request, 'trace-7'))).toEqual([
			'statusCode',
			'error',
			'message',
			'code',
			'details',
			'timestamp',
			'path',
			'traceId'
		]);
	});

	it('keeps statusCode, error and message as they are', () => {
		const body = toApiErrorBody(exception, request, 'trace-7');

		expect(body.statusCode).toBe(409);
		expect(body.error).toBe('Conflict');
		expect(body.message).toBe('conflict');
		expect(body.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		expect(body.details).toEqual({ expectedVersion: 3 });
	});

	it('stamps an ISO-8601 timestamp that parses', () => {
		const body = toApiErrorBody(exception, request);

		expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
	});

	it('reports the path that was requested', () => {
		expect(toApiErrorBody(exception, request).path).toBe('/api/roles/1?fields=id');
		expect(toApiErrorBody(exception, { url: '/api/roles' }).path).toBe('/api/roles');
		expect(toApiErrorBody(exception).path).toBe('');
	});

	it('carries the trace id it was given, and an empty string when there is none', () => {
		expect(toApiErrorBody(exception, request, 'trace-7').traceId).toBe('trace-7');
		expect(toApiErrorBody(exception, request).traceId).toBe('');
	});
});
