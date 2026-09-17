import { ArgumentsHost, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ApiErrorCode } from './api-error-codes';
import { ApiException } from './api-exception';
import { ApiExceptionFilter } from './api-exception.filter';
import { DatabaseErrorFilter } from './database-error.filter';

/**
 * The filter is the one change in this workstream that touches every endpoint's error path, so the
 * rules it must not break are asserted against the real adapter contract rather than a hand-rolled
 * reply:
 *
 * - an exception that carries no code is answered with exactly the bytes it is answered with today;
 * - an `ApiException` gains the envelope and nothing else changes;
 * - a database payload is described, never echoed, and still carries a code;
 * - the status is never rewritten.
 */
describe('ApiExceptionFilter', () => {
	let captured: { status?: number; body?: any };
	let filter: ApiExceptionFilter;

	const driverFailure = () =>
		Object.assign(new Error('select * from "role" where id = $1'), {
			query: 'select * from "role" where id = $1',
			parameters: ['6b1e0f2a-secret-value'],
			driverError: { code: '42P01', message: 'relation "role" does not exist' }
		});

	beforeEach(() => {
		captured = {};
		const adapter = {
			reply: (_res: unknown, body: any, status: number) => {
				captured.body = body;
				captured.status = status;
			},
			isHeadersSent: () => false,
			end: () => undefined,
			status: () => undefined
		};
		filter = new ApiExceptionFilter(adapter as any);
	});

	const request = { method: 'PUT', url: '/api/roles/1', originalUrl: '/api/roles/1?fields=id' };
	const response = {};

	const host = (): ArgumentsHost =>
		({
			switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
			// BaseExceptionFilter reaches the express response through getArgByIndex(1), not switchToHttp
			getArgByIndex: (index: number) => (index === 0 ? request : response)
		} as unknown as ArgumentsHost);

	it('renders the envelope for an ApiException', () => {
		filter.catch(
			new ApiException(HttpStatus.CONFLICT, ApiErrorCode.ENTITY_VERSION_CONFLICT, 'The order was modified.', {
				expectedVersion: 3,
				actualVersion: 4
			}),
			host()
		);

		expect(captured.status).toBe(409);
		expect(captured.body.statusCode).toBe(409);
		expect(captured.body.error).toBe('Conflict');
		expect(captured.body.message).toBe('The order was modified.');
		expect(captured.body.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		expect(captured.body.details).toEqual({ expectedVersion: 3, actualVersion: 4 });
		expect(captured.body.path).toBe('/api/roles/1?fields=id');
		expect(typeof captured.body.timestamp).toBe('string');
	});

	it('answers a plain HttpException with exactly today bytes', () => {
		filter.catch(new HttpException('Role could not be found', HttpStatus.NOT_FOUND), host());

		expect(captured.status).toBe(404);
		expect(JSON.stringify(captured.body)).toBe(
			JSON.stringify({ statusCode: 404, message: 'Role could not be found' })
		);
		expect(captured.body).not.toHaveProperty('code');
		expect(captured.body).not.toHaveProperty('timestamp');
		expect(captured.body).not.toHaveProperty('traceId');
	});

	it('leaves a class-validator body alone, array and all', () => {
		filter.catch(
			new BadRequestException({ statusCode: 400, message: ['name must be a string'], error: 'Bad Request' }),
			host()
		);

		expect(JSON.stringify(captured.body)).toBe(
			JSON.stringify({ statusCode: 400, message: ['name must be a string'], error: 'Bad Request' })
		);
		expect(captured.body).not.toHaveProperty('code');
	});

	it('describes a database payload instead of echoing it, and codes it INTERNAL_ERROR', () => {
		filter.catch(new BadRequestException(driverFailure()), host());

		const serialized = JSON.stringify(captured.body);

		expect(captured.status).toBe(400);
		expect(captured.body.code).toBe(ApiErrorCode.INTERNAL_ERROR);
		expect(captured.body).not.toHaveProperty('query');
		expect(captured.body).not.toHaveProperty('parameters');
		expect(captured.body).not.toHaveProperty('driverError');
		expect(serialized).not.toContain('select * from');
		expect(serialized).not.toContain('secret-value');
		expect(serialized).not.toContain('42P01');
	});

	it('never rewrites the status, whatever the payload', () => {
		filter.catch(new HttpException({ statusCode: 409, message: 'failed' }, HttpStatus.CONFLICT), host());
		expect(captured.status).toBe(409);

		captured = {};
		filter.catch(new BadRequestException(driverFailure()), host());
		expect(captured.status).toBe(400);

		captured = {};
		filter.catch(new ApiException(428, ApiErrorCode.PRECONDITION_REQUIRED, 'If-Match is required.'), host());
		expect(captured.status).toBe(428);
	});

	it('still lets the database filter do its own job when it is the one registered', () => {
		// The application keeps `DatabaseErrorFilter` registered as well; the envelope filter
		// delegates to its `catch`, so its behaviour has to hold on its own too.
		const standalone = { reply: (_res: unknown, body: any) => (captured.body = body), isHeadersSent: () => false };
		new DatabaseErrorFilter(standalone as any).catch(new BadRequestException(driverFailure()) as any, host());

		expect(JSON.stringify(captured.body)).not.toContain('select * from');
		expect(JSON.stringify(captured.body)).not.toContain('secret-value');
	});
});
