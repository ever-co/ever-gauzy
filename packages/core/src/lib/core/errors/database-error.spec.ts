import { ArgumentsHost, BadRequestException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import {
	describeDatabaseError,
	GENERIC_DATABASE_ERROR_MESSAGE,
	isDatabaseErrorPayload,
	looksLikeDriverCode,
	redactDatabaseError,
	safeErrorMessage,
	safeMessageForDatabaseText,
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
	it('recognizes a driver error by shape, not by class', () => {
		expect(isDatabaseErrorPayload(queryFailure())).toBe(true);
		// driver-only keys are conclusive on their own
		expect(isDatabaseErrorPayload({ driverError: {} })).toBe(true);
		expect(isDatabaseErrorPayload({ sqlMessage: 'Duplicate entry' })).toBe(true);
		// a statement string is only conclusive alongside bound parameters or a driver code
		expect(isDatabaseErrorPayload({ query: 'SELECT 1', parameters: [] })).toBe(true);
		expect(isDatabaseErrorPayload({ sql: 'SELECT 1', code: 'ER_DUP_ENTRY' })).toBe(true);
	});

	it('recognizes the real driver shapes', () => {
		// mysql2
		expect(
			isDatabaseErrorPayload({
				code: 'ER_DUP_ENTRY',
				errno: 1062,
				sqlMessage: "Duplicate entry 'x' for key 'user.email'",
				sql: 'INSERT INTO `user` …'
			})
		).toBe(true);
		// better-sqlite3
		expect(isDatabaseErrorPayload({ code: 'SQLITE_CONSTRAINT_UNIQUE', message: 'UNIQUE constraint failed' })).toBe(
			true
		);
		// pg
		expect(isDatabaseErrorPayload({ code: '23505', severity: 'ERROR', constraint: 'user_email_key' })).toBe(true);
	});

	it('leaves ordinary payloads alone', () => {
		expect(isDatabaseErrorPayload(undefined)).toBe(false);
		expect(isDatabaseErrorPayload(null)).toBe(false);
		expect(isDatabaseErrorPayload('a plain message')).toBe(false);
		expect(isDatabaseErrorPayload({ statusCode: 400, message: 'nope', error: 'Bad Request' })).toBe(false);
		// class-validator's shape must survive — the UI renders these
		expect(isDatabaseErrorPayload({ statusCode: 400, message: ['name must be a string'] })).toBe(false);
	});

	it('does not condemn a body just because it has a generically-named field', () => {
		// This decides whether a body is replaced WHOLESALE, so the keys have to be driver-only.
		// `parameter` is an ordinary English word a real handler may well use.
		expect(isDatabaseErrorPayload({ statusCode: 400, message: 'Missing filter', parameter: 'since' })).toBe(false);
		expect(isDatabaseErrorPayload({ message: 'Saved', query: '' })).toBe(false);
		expect(isDatabaseErrorPayload({ message: 'Search failed', query: 'annual leave' })).toBe(false);
	});

	it('ignores INHERITED look-alike members, checking own properties only', () => {
		class Suspicious {
			get query() {
				return 'SELECT 1';
			}
			get parameters() {
				return [];
			}
		}
		expect(isDatabaseErrorPayload(new Suspicious())).toBe(false);
	});

	it('still catches a bare driver error carrying only a recognized code', () => {
		expect(isDatabaseErrorPayload({ code: '23505', message: 'duplicate key' })).toBe(true);
		expect(isDatabaseErrorPayload({ code: 'SQLITE_CONSTRAINT_FOREIGNKEY' })).toBe(true);
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
		filter.catch(new HttpException('resource is gone', 404), host());

		expect(captured.status).toBe(404);
		expect(captured.body).toEqual({ statusCode: 404, message: 'resource is gone' });
	});

	it('THE REGRESSION THAT SHIPPED: real hand-written messages are never rewritten', () => {
		// The first version of the raw-SQL signature was case-INSENSITIVE. Measured against the 382
		// distinct hand-written exception messages in this repo it rewrote FOURTEEN of them into the
		// generic string. These are the real ones, verbatim.
		const realMessages = [
			'Please select valid Date, start time and end time',
			'Cannot downgrade to the same plan. Please select a different plan.',
			'Failed to update the password.',
			'Failed to update employee profile.',
			'Update data is required',
			'Plugin update input is required',
			'You cannot update timesheet status without providing IDs',
			'You do not have permission to update this active task.',
			'Employee context is required to update the job search status.',
			'Make.com team ID is not configured. Please select a team first.'
		];

		for (const message of realMessages) {
			captured = {};
			const deliberate = new BadRequestException(message);
			filter.catch(deliberate, host());
			expect(captured.body).toEqual(deliberate.getResponse());
		}
	});

	it('drops a nested driver error instead of copying it into the body', () => {
		// A handler that throws `{ message: error?.message, error }` puts the whole driver object one
		// level down; sanitizing only `message` would still ship query/parameters.
		filter.catch(
			new BadRequestException({
				statusCode: 400,
				message: 'duplicate key value violates unique constraint "user_email_key"',
				error: queryFailure({ code: '23505' })
			}) as any,
			host()
		);

		const serialized = JSON.stringify(captured.body);
		expect(serialized).not.toContain('secret-value');
		expect(serialized).not.toContain('INSERT INTO');
		expect(serialized).not.toContain('parameters');
		expect(captured.body.message).toBe('A record with these values already exists.');
	});

	it('removes a driver error nested TWO levels down, not just direct children', () => {
		// `{ error: { cause: queryFailure } }` — a one-level scrub left error.cause.query and its
		// bound parameters in the rebuilt body.
		filter.catch(
			new BadRequestException({
				statusCode: 400,
				message: 'duplicate key value violates unique constraint "x"',
				error: { cause: queryFailure({ code: '23505' }), note: 'kept' }
			}) as any,
			host()
		);

		const serialized = JSON.stringify(captured.body);
		expect(serialized).not.toContain('secret-value');
		expect(serialized).not.toContain('INSERT INTO');
		expect(serialized).not.toContain('parameters');
		// the caller's own non-database data is preserved
		expect(serialized).toContain('kept');
	});

	it('removes a driver error nested inside an array', () => {
		filter.catch(
			new BadRequestException({
				statusCode: 400,
				message: 'duplicate key value violates unique constraint "x"',
				details: [{ ok: true }, queryFailure({ code: '23505' })]
			}) as any,
			host()
		);

		expect(JSON.stringify(captured.body)).not.toContain('secret-value');
	});

	it('sanitizes an UNMAPPED driver code — recognition and translation are separate', () => {
		// 42P01 (undefined_table), SQLITE_BUSY and ER_LOCK_DEADLOCK have no friendly message, but
		// they are unmistakably driver output and their messages name real tables.
		for (const [code, message] of [
			['42P01', 'relation "user" does not exist'],
			['SQLITE_BUSY', 'database is locked'],
			['ER_LOCK_DEADLOCK', 'Deadlock found when trying to get lock on `user`']
		]) {
			captured = {};
			filter.catch(new BadRequestException({ code, message }) as any, host());
			expect(captured.body.message).toBe(GENERIC_DATABASE_ERROR_MESSAGE);
			expect(JSON.stringify(captured.body)).not.toContain('user');
		}
	});

	it('survives a payload with a circular reference instead of throwing inside the filter', () => {
		// A driver error can hold a reference back to the connection. A throw in an exception filter
		// aborts the response, so the logging path must not serialize blindly.
		const circular: any = queryFailure({ code: '23505' });
		circular.driverError.self = circular;

		expect(() => filter.catch(new BadRequestException(circular) as any, host())).not.toThrow();
		expect(captured.status).toBe(400);
		expect(JSON.stringify(captured.body)).not.toContain('INSERT INTO');
	});

	it('an array message keeps its array shape (class-validator contract)', () => {
		// safeMessageForDatabaseText only accepts strings, so an array passes through. Pinned so a
		// later change cannot silently turn a list into a string for the same status code.
		const validation = new BadRequestException({
			statusCode: 400,
			message: ['duplicate key value violates unique constraint "x"'],
			error: 'Bad Request'
		});
		filter.catch(validation, host());
		expect(Array.isArray(captured.body.message)).toBe(true);
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

describe('registration contract', () => {
	it('REQUIRES an HTTP adapter — constructing without one breaks every ordinary error', () => {
		// BaseExceptionFilter resolves its adapter through @Optional() @Inject(), which only runs under
		// DI. Built with `new` and no argument it has none, and the inherited super.catch() path throws
		// while handling ordinary HttpExceptions — turning validation/auth/not-found into 500s.
		// Both registration sites therefore pass app.getHttpAdapter(); this pins that requirement.
		const withoutAdapter = new DatabaseErrorFilter();
		const host = {
			getArgByIndex: () => ({}),
			switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) })
		} as unknown as ArgumentsHost;

		expect(() => withoutAdapter.catch(new BadRequestException('a plain message'), host)).toThrow(TypeError);
	});
});

describe('safeErrorMessage', () => {
	it('describes a database error by its code', () => {
		expect(safeErrorMessage(queryFailure({ code: '23503' }))).toBe(
			'A related record referenced by this request does not exist.'
		);
	});

	it('keeps a non-database error message — not every failure is a constraint violation', () => {
		expect(safeErrorMessage(new Error('Entity was not found'))).toBe('Entity was not found');
	});

	it('still sanitizes driver text arriving as a plain message', () => {
		expect(safeErrorMessage(new Error('value too long for type character varying(255)'))).toBe(
			'A value in this request is too long.'
		);
	});
});

describe('redactDatabaseError', () => {
	it('keeps the diagnostics but drops the bound values', () => {
		const redacted = redactDatabaseError(queryFailure({ code: '23505' })) as any;
		const serialized = JSON.stringify(redacted);

		expect(serialized).not.toContain('secret-value');
		expect(redacted.parameters).toMatch(/redacted/);
		// the parts that make it diagnosable survive
		expect(redacted.code).toBe('23505');
		expect(redacted.query).toContain('INSERT INTO');
	});

	it('passes a non-database error straight through', () => {
		const plain = new Error('nope');
		expect(redactDatabaseError(plain)).toBe(plain);
	});
});

describe('looksLikeDriverCode', () => {
	it.each([
		['23505'], // postgres unique_violation
		['42P01'], // postgres undefined_table
		['22P02'], // postgres invalid_text_representation
		['SQLITE_BUSY'],
		['SQLITE_CONSTRAINT_UNIQUE'],
		['ER_LOCK_DEADLOCK'],
		['ER_DUP_ENTRY']
	])('recognizes %s as a driver code even when it has no mapped message', (code) => {
		expect(looksLikeDriverCode(code)).toBe(true);
	});

	it.each([
		['ECONNREFUSED'],
		['ETIMEDOUT'],
		['ENOTFOUND'],
		['ELIFECYCLE'],
		['NOT_FOUND'],
		['FORBIDDEN'],
		['E_VALIDATION'],
		['400'],
		['abcde'],
		[''],
		[undefined],
		[42]
	])(
		'does not mistake %p for a driver code (network codes come from any HTTP client)',
		(code) => {
			expect(looksLikeDriverCode(code)).toBe(false);
		}
	);
});

describe('logging redaction (logs outlive responses)', () => {
	const queryFailureWithValue = () =>
		Object.assign(
			new QueryFailedError('INSERT INTO `user`(`email`) VALUES (?)', ['alice@example.com'], {
				code: 'ER_DUP_ENTRY'
			} as any),
			{ message: "Duplicate entry 'alice@example.com' for key 'user.email'" }
		);

	it('masks the rejected value MySQL embeds in the driver message', () => {
		const serialized = JSON.stringify(redactDatabaseError(queryFailureWithValue()));

		expect(serialized).not.toContain('alice@example.com');
		// the constraint is still identifiable for diagnosis
		expect(serialized).toContain('redacted');
		expect(serialized).toContain('ER_DUP_ENTRY');
	});

	it('keeps double-quoted identifiers, which name constraints rather than user data', () => {
		const pgError = Object.assign(new QueryFailedError('INSERT INTO "user" ...', [], { code: '23505' } as any), {
			message: 'duplicate key value violates unique constraint "user_email_key"'
		});
		expect(JSON.stringify(redactDatabaseError(pgError))).toContain('user_email_key');
	});
});

describe('driver message signatures', () => {
	it('catches a lower-cased statement (the structural requirement is what keeps this safe)', () => {
		expect(safeMessageForDatabaseText('failed: insert into "user" ("email") values ($1)')).toBe(
			GENERIC_DATABASE_ERROR_MESSAGE
		);
	});

	it('catches ER_ codes that carry digits', () => {
		// `ER_NO_REFERENCED_ROW_2` did not match `\bER_[A-Z_]{3,}\b` at all — the trailing `_2` left
		// no word boundary.
		expect(safeMessageForDatabaseText('Cannot add or update a child row: ER_NO_REFERENCED_ROW_2')).toBeDefined();
	});
});

describe('review-pass regressions', () => {
	it('recognizes letter-leading PostgreSQL SQLSTATEs', () => {
		// P0001 is what every PL/pgSQL RAISE produces; XX000 is internal_error.
		for (const code of ['P0001', 'XX000', 'F0000', 'HV000', '23505', '42P01']) {
			expect(looksLikeDriverCode(code)).toBe(true);
		}
	});

	it('does not mistake a five-letter word for a SQLSTATE', () => {
		// The obvious widening to /^[0-9A-Z]{5}$/ matches these; every real SQLSTATE has a digit.
		for (const code of ['ADMIN', 'LOGIN', 'TOKEN', 'EMPTY', 'VALID']) {
			expect(looksLikeDriverCode(code)).toBe(false);
		}
	});

	it('sanitizes an unmapped driver error rather than returning its message', () => {
		// toSafeHttpException used to hand this to sanitizeErrorBody, which collapses an Error to its
		// `.message` and drops the code — so `42P01` became the bare string `relation "user" does not
		// exist`, which matches no message signature and reached the client naming a real table.
		const { toSafeHttpException } = require('../interceptors/safe-http-exception');
		const failure: any = new QueryFailedError('SELECT * FROM "user"', ['secret-value'], {
			code: '42P01'
		} as any);
		failure.message = 'relation "user" does not exist';

		const safe = toSafeHttpException(new BadRequestException(failure));
		const serialized = JSON.stringify(safe.getResponse());

		expect(safe.getStatus()).toBe(400);
		expect(serialized).not.toContain('relation');
		expect(serialized).not.toContain('secret-value');
		expect(serialized).not.toContain('SELECT');
	});
});

describe('log masking of value-bearing quotes', () => {
	const withMessage = (message: string) =>
		Object.assign(new QueryFailedError('SELECT 1', [], { code: '22P02' } as any), { message });

	it('masks a postgres rejected value, which follows a colon', () => {
		const out = JSON.stringify(redactDatabaseError(withMessage('invalid input syntax for type uuid: "not-a-uuid"')));
		expect(out).not.toContain('not-a-uuid');
	});

	it('keeps a double-quoted constraint identifier, which is diagnostic', () => {
		const out = JSON.stringify(
			redactDatabaseError(withMessage('duplicate key value violates unique constraint "user_email_key"'))
		);
		expect(out).toContain('user_email_key');
	});

	it("handles SQL's doubled-quote escape without splitting the literal", () => {
		const out = JSON.stringify(redactDatabaseError(withMessage("Duplicate entry 'O''Brien' for key 'user.name'")));
		expect(out).not.toContain('Brien');
	});
});
