import {
	BadRequestException,
	ConflictException,
	HttpException,
	HttpStatus,
	NotFoundException,
	ServiceUnavailableException
} from '@nestjs/common';
import { sanitizeErrorBody, toSafeHttpException } from './safe-http-exception';

describe('toSafeHttpException', () => {
	it('re-issues a BadRequestException with its own (array) body', () => {
		const original = new BadRequestException(['name must be a string']);
		const result = toSafeHttpException(original);
		expect(result).toBeInstanceOf(BadRequestException);
		// Nest normalises the array into `{ statusCode, message, error }` at construction; that
		// object is what travels, unchanged.
		expect(result.getResponse()).toEqual(original.getResponse());
	});

	it('keeps a structured body so clients can branch on it', () => {
		const result = toSafeHttpException(
			new ServiceUnavailableException({ message: 'no voice provider', code: 'AI_SPEECH_NOT_CONFIGURED', settingsPath: '/x' })
		);
		expect(result.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
		expect(result.getResponse()).toEqual({
			message: 'no voice provider',
			code: 'AI_SPEECH_NOT_CONFIGURED',
			settingsPath: '/x'
		});
	});

	it('returns the ORIGINAL instance when there is nothing to scrub', () => {
		const notFound = new NotFoundException('Document 1 was not found');
		expect(toSafeHttpException(notFound)).toBe(notFound);
		const structured = new ConflictException({ message: 'taken', code: 'DOCS_CONTENT_CONFLICT' });
		expect(toSafeHttpException(structured)).toBe(structured);
	});

	it('collapses an embedded raw error to its message and drops SQL / driver / transport internals', () => {
		const driverError = Object.assign(new Error('duplicate key value violates unique constraint "UQ_email"'), {
			query: 'INSERT INTO "user" ("email") VALUES ($1)',
			parameters: ['admin@ever.co'],
			driverError: { detail: 'Key (email)=(admin@ever.co) already exists.', table: 'user' },
			stack: 'QueryFailedError: at ...'
		});
		const result = toSafeHttpException(new HttpException({ message: 'Create failed', error: driverError }, 400));
		expect(result.getStatus()).toBe(400);
		expect(result.getResponse()).toEqual({ message: 'Create failed', error: driverError.message });
		expect(JSON.stringify(result.getResponse())).not.toContain('INSERT INTO');
		expect(JSON.stringify(result.getResponse())).not.toContain('admin@ever.co');
	});

	it('strips request/response/config keys (Axios errors carry headers) at any depth', () => {
		const body = {
			message: 'Upstream failed',
			details: { config: { headers: { Authorization: 'Bearer secret' } }, code: 'ECONNRESET', nested: { stack: 'x', ok: 1 } }
		};
		const result = toSafeHttpException(new ConflictException(body));
		expect(result.getResponse()).toEqual({ message: 'Upstream failed', details: { code: 'ECONNRESET', nested: { ok: 1 } } });
	});

	it('turns a non-HTTP error into a 500 instead of a status-less (200) exception', () => {
		const result = toSafeHttpException(new Error('String-array "relations" syntax has been removed'));
		expect(result.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
		expect(result.getResponse()).toBe('String-array "relations" syntax has been removed');
	});

	it('honours a numeric 4xx/5xx status on a non-HTTP error but not a stray exit code', () => {
		expect(toSafeHttpException({ message: 'gone', status: 410 }).getStatus()).toBe(410);
		expect(toSafeHttpException({ message: 'child died', status: 1 }).getStatus()).toBe(500);
		expect(toSafeHttpException(undefined).getStatus()).toBe(500);
	});
});

describe('sanitizeErrorBody', () => {
	it('passes primitives and arrays through and bounds the depth', () => {
		expect(sanitizeErrorBody('x')).toBe('x');
		expect(sanitizeErrorBody([1, new Error('e')])).toEqual([1, 'e']);
		const deep = { a: { b: { c: { d: { e: 1 } } } } };
		expect(sanitizeErrorBody(deep)).toEqual({ a: { b: { c: {} } } });
	});
});
