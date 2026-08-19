import { ArgumentsHost, BadRequestException, ConflictException, HttpStatus } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import {
	describeDatabaseError,
	GENERIC_DATABASE_ERROR_MESSAGE,
	isDatabaseErrorPayload,
	toClientSafeError
} from './database-error';
import { DatabaseErrorFilter } from './database-error.filter';

/**
 * Regression suite for the raw-SQL disclosure.
 *
 * `throw new BadRequestException(error)` with a caught TypeORM error put the driver's own object in
 * the response body, and `JSON.stringify` of a `QueryFailedError` emits its ENUMERABLE own
 * properties — `query`, `parameters`, `driverError`. `message`/`name` are non-enumerable, so the
 * only safe part was the part that got dropped. Any authenticated caller able to trip a constraint
 * could read the statement text and every bound value.
 */

/** A real QueryFailedError, so the enumerable-property behaviour is the driver's, not a mock's. */
const queryFailure = (driverError: any = { code: '23505' }) =>
	new QueryFailedError(
		'INSERT INTO "goal"("deletedAt", "createdAt", "name") VALUES ($1, $2, $3)',
		[null, '2026-08-20', 'secret-value'],
		driverError
	);

describe('QueryFailedError serialization (the reason this exists)', () => {
	it('CONTROL: serializing the raw error exposes the statement and the bound values', () => {
		const body = JSON.parse(JSON.stringify(queryFailure()));
		expect(body).toHaveProperty('query');
		expect(body).toHaveProperty('parameters');
		expect(JSON.stringify(body)).toContain('secret-value');
	});
});

describe('isDatabaseErrorPayload', () => {
	it('recognises a driver error by shape, not by class', () => {
		expect(isDatabaseErrorPayload(queryFailure())).toBe(true);
		expect(isDatabaseErrorPayload({ query: 'SELECT 1', parameters: [] })).toBe(true);
		expect(isDatabaseErrorPayload({ sql: 'SELECT 1' })).toBe(true);
		expect(isDatabaseErrorPayload({ driverError: {} })).toBe(true);
	});

	it('leaves ordinary payloads alone', () => {
		expect(isDatabaseErrorPayload(undefined)).toBe(false);
		expect(isDatabaseErrorPayload(null)).toBe(false);
		expect(isDatabaseErrorPayload('a plain message')).toBe(false);
		expect(isDatabaseErrorPayload({ statusCode: 400, message: 'nope', error: 'Bad Request' })).toBe(false);
		// class-validator's shape must survive — the UI renders these
		expect(isDatabaseErrorPayload({ statusCode: 400, message: ['name must be a string'] })).toBe(false);
	});
});

describe('describeDatabaseError', () => {
	it.each([
		['23505', 'A record with these values already exists.'],
		['ER_DUP_ENTRY', 'A record with these values already exists.'],
		['SQLITE_CONSTRAINT_UNIQUE', 'A record with these values already exists.'],
		['23503', 'A related record referenced by this request does not exist.'],
		['SQLITE_CONSTRAINT_FOREIGNKEY', 'A related record referenced by this request does not exist.'],
		['23502', 'A required field is missing.'],
		['SQLITE_CONSTRAINT_NOTNULL', 'A required field is missing.'],
		['22P02', 'A value in this request has the wrong format.']
	])('maps driver code %s to a specific, non-leaking message', (code, expected) => {
		expect(describeDatabaseError(queryFailure({ code }))).toBe(expected);
	});

	it('falls back to the generic message for an unknown or absent code', () => {
		expect(describeDatabaseError(queryFailure({}))).toBe(GENERIC_DATABASE_ERROR_MESSAGE);
		expect(describeDatabaseError(queryFailure({ code: 'SOMETHING_NEW' }))).toBe(GENERIC_DATABASE_ERROR_MESSAGE);
	});

	it('never echoes the driver message, which embeds column and constraint names', () => {
		const error = queryFailure({ code: '23505', message: 'duplicate key value violates unique constraint "user_email_key"' });
		expect(describeDatabaseError(error)).not.toContain('user_email_key');
	});
});

describe('toClientSafeError', () => {
	it('replaces a database payload with a safe string', () => {
		const safe = toClientSafeError(queryFailure({ code: '23505' }));
		expect(typeof safe).toBe('string');
		expect(JSON.stringify(safe)).not.toContain('secret-value');
	});

	it('passes non-database values through untouched', () => {
		const validation = { statusCode: 400, message: ['name must be a string'], error: 'Bad Request' };
		expect(toClientSafeError(validation)).toBe(validation);
		expect(toClientSafeError('plain message')).toBe('plain message');
	});

	it('keeps the 400 status when used at a throw site', () => {
		const thrown = new BadRequestException(toClientSafeError(queryFailure()));
		expect(thrown.getStatus()).toBe(HttpStatus.BAD_REQUEST);
		expect(JSON.stringify(thrown.getResponse())).not.toContain('query');
	});
});

describe('DatabaseErrorFilter', () => {
	/**
	 * The filter delegates every non-leaking case to Nest's own BaseExceptionFilter, so the stub here
	 * is the HTTP ADAPTER — capturing exactly the body Nest would have sent. Asserting against that,
	 * rather than against a hand-rolled reply, is what proves the pass-through cases are unchanged.
	 */
	let captured: { status?: number; body?: any };
	let filter: DatabaseErrorFilter;

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
		filter = new DatabaseErrorFilter(adapter as any);
	});

	const request = { method: 'POST', url: '/api/organization-department' };
	const response = {};

	const host = (): ArgumentsHost =>
		({
			switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
			// BaseExceptionFilter reaches the express response through getArgByIndex(1), not switchToHttp
			getArgByIndex: (index: number) => (index === 0 ? request : response)
		} as unknown as ArgumentsHost);

	it('strips query and parameters from a leaked payload', () => {
		filter.catch(new BadRequestException(queryFailure({ code: '23505' })) as any, host());

		expect(captured.status).toBe(400);
		const serialized = JSON.stringify(captured.body);
		expect(serialized).not.toContain('query');
		expect(serialized).not.toContain('parameters');
		expect(serialized).not.toContain('secret-value');
		expect(serialized).not.toContain('INSERT INTO');
		expect(captured.body.message).toBe('A record with these values already exists.');
	});

	it('preserves the original status code — a failed write stays 400, a conflict stays 409', () => {
		filter.catch(new BadRequestException(queryFailure()) as any, host());
		expect(captured.status).toBe(HttpStatus.BAD_REQUEST);

		captured = {};
		filter.catch(new ConflictException(queryFailure()) as any, host());
		expect(captured.status).toBe(HttpStatus.CONFLICT);
	});

	it('replies to a deliberate exception byte-for-byte', () => {
		const deliberate = new BadRequestException('Time off request was not found');
		filter.catch(deliberate, host());

		expect(captured.status).toBe(400);
		expect(captured.body).toEqual(deliberate.getResponse());
		expect(captured.body.message).toBe('Time off request was not found');
	});

	it.each([
		['duplicate key value violates unique constraint "user_email_key"', 'A record with these values already exists.'],
		["Duplicate entry 'alice@example.com' for key 'user.email'", 'A record with these values already exists.'],
		['SQLITE_CONSTRAINT_UNIQUE: UNIQUE constraint failed: user.email', 'A record with these values already exists.'],
		[
			'insert or update on table "goal" violates foreign key constraint "FK_goal_org"',
			'A related record referenced by this request does not exist.'
		],
		[
			'null value in column "name" of relation "goal" violates not-null constraint',
			'A required field is missing.'
		],
		['invalid input syntax for type uuid: "not-a-uuid"', 'A value in this request has the wrong format.']
	])('rewrites the driver message %#, which names tables/columns/values', (driverMessage, expected) => {
		// The ~160 sites that throw `error.message` produce exactly this: a plain string payload.
		filter.catch(new BadRequestException(driverMessage), host());

		expect(captured.body.message).toBe(expected);
		expect(captured.status).toBe(400);
		const serialized = JSON.stringify(captured.body);
		expect(serialized).not.toContain('user_email_key');
		expect(serialized).not.toContain('alice@example.com');
		expect(serialized).not.toContain('FK_goal_org');
		expect(serialized).not.toContain('not-a-uuid');
	});

	it.each([
		'Time off request was not found',
		'The record belongs to another tenant',
		'Only SUPER_ADMIN can register other SUPER_ADMIN users.',
		'Files of type ".svg" are not allowed',
		'shareRules.relations may not be nested deeper than 2 levels',
		'Cannot share an entity that does not belong to your tenant',
		// a hand-written null complaint must NOT be mistaken for MySQL's "Column 'x' cannot be null"
		'Organization cannot be null',
		// the safe messages themselves must pass through unchanged (idempotent)
		'A required field is missing.',
		'A record with these values already exists.'
	])('leaves the hand-written message %p exactly as it is', (message) => {
		const deliberate = new BadRequestException(message);
		filter.catch(deliberate, host());

		expect(captured.body).toEqual(deliberate.getResponse());
	});

	it('wraps a bare-string HttpException exactly as Nest does', () => {
		// `new HttpException('msg', 404).getResponse()` returns a STRING, not an object, and Nest's own
		// handler wraps it as `{ statusCode, message }`. A filter that replies with the raw payload
		// would answer a bare JSON string instead — silently changing every such response in the app.
		const { HttpException } = require('@nestjs/common');
		filter.catch(new HttpException('resource is gone', 404), host());

		expect(captured.status).toBe(404);
		expect(captured.body).toEqual({ statusCode: 404, message: 'resource is gone' });
	});

	it('does not disturb class-validator responses', () => {
		const validation = new BadRequestException({
			statusCode: 400,
			message: ['name must be a string', 'email must be an email'],
			error: 'Bad Request'
		});
		filter.catch(validation, host());

		expect(captured.body.message).toEqual(['name must be a string', 'email must be an email']);
	});
});
