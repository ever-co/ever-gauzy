import { assertValidDatabaseType, parsePositiveIntEnv } from './database-helpers';

/**
 * TASK 5 (Configuration Schema and Startup Validation) of the improvement roadmap.
 *
 * Before `assertValidDatabaseType`/`parsePositiveIntEnv` existed, `database.ts` read `DB_TYPE` and
 * every DB pool/timeout env var with no validation: an unrecognized `DB_TYPE` fell through the
 * `switch` silently (every connection config stayed `undefined`), and an unparsable numeric value
 * became `NaN` and was only caught much later, deep inside a driver. Both are now fail-fast at the
 * moment `database.ts` is imported (module load time), covered here first as pure functions, then
 * again as `database.ts` module-load behavior via `jest.isolateModules` — the same pattern
 * `database-helpers.spec.ts` already uses, required because `database.ts` computes its exports from
 * `process.env` at import time, not per-call.
 */
describe('assertValidDatabaseType', () => {
	it.each(['mongodb', 'sqlite', 'better-sqlite3', 'postgres', 'mysql'])(
		'accepts the supported value %s',
		(value) => {
			expect(() => assertValidDatabaseType(value)).not.toThrow();
		}
	);

	it('throws a descriptive error naming the bad value for an unrecognized DB_TYPE', () => {
		expect(() => assertValidDatabaseType('postgress')).toThrow(/Invalid DB_TYPE "postgress"/);
	});

	it("lists the supported values in the error message, so a typo is easy to fix", () => {
		expect(() => assertValidDatabaseType('bogus')).toThrow(/better-sqlite3/);
	});
});

describe('parsePositiveIntEnv', () => {
	it('returns the default when the variable is unset', () => {
		expect(parsePositiveIntEnv('DB_PORT', undefined, 5432)).toBe(5432);
	});

	it('returns the default when the variable is an empty string', () => {
		expect(parsePositiveIntEnv('DB_PORT', '', 5432)).toBe(5432);
	});

	it('parses a valid positive integer', () => {
		expect(parsePositiveIntEnv('DB_PORT', '5433', 5432)).toBe(5433);
	});

	it('throws instead of silently returning NaN for a non-numeric value', () => {
		expect(() => parsePositiveIntEnv('DB_PORT', 'not-a-number', 5432)).toThrow(
			/Invalid DB_PORT "not-a-number"/
		);
	});

	it.each(['0', '-5'])('rejects a non-positive value (%s)', (value) => {
		expect(() => parsePositiveIntEnv('DB_POOL_SIZE', value, 40)).toThrow(/Invalid DB_POOL_SIZE/);
	});
});

describe('database.ts fails fast at import time on an unrecognized DB_TYPE', () => {
	const originalDbType = process.env.DB_TYPE;
	afterEach(() => {
		if (originalDbType === undefined) delete process.env.DB_TYPE;
		else process.env.DB_TYPE = originalDbType;
	});

	it('throws when DB_TYPE is a typo/unsupported value', () => {
		process.env.DB_TYPE = 'postgress';
		jest.isolateModules(() => {
			expect(() => require('./database')).toThrow(/Invalid DB_TYPE "postgress"/);
		});
	});

	it('throws a real Error (not a bare string) for DB_TYPE=mongodb', () => {
		process.env.DB_TYPE = 'mongodb';
		jest.isolateModules(() => {
			expect(() => require('./database')).toThrow(/mongodb is not supported yet/);
		});
	});
});

describe('database.ts fails fast at import time on an unparsable numeric env var', () => {
	const originalDbType = process.env.DB_TYPE;
	const originalPoolSize = process.env.DB_POOL_SIZE;
	afterEach(() => {
		if (originalDbType === undefined) delete process.env.DB_TYPE;
		else process.env.DB_TYPE = originalDbType;
		if (originalPoolSize === undefined) delete process.env.DB_POOL_SIZE;
		else process.env.DB_POOL_SIZE = originalPoolSize;
	});

	it('throws when DB_POOL_SIZE does not parse to a positive integer', () => {
		process.env.DB_TYPE = 'postgres';
		process.env.DB_POOL_SIZE = 'not-a-number';
		jest.isolateModules(() => {
			expect(() => require('./database')).toThrow(/Invalid DB_POOL_SIZE "not-a-number"/);
		});
	});
});
