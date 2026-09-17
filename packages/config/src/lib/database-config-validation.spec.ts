// cspell:ignore postgress — the deliberately misspelled DB_TYPE these tests feed in
import { assertValidDatabaseType, parseIntEnv } from './database-helpers';

/**
 * TASK 5 (Configuration Schema and Startup Validation) of the improvement roadmap.
 *
 * Before `assertValidDatabaseType`/`parseIntEnv` existed, `database.ts` read `DB_TYPE` and every DB
 * pool/timeout env var with no validation: an unrecognized `DB_TYPE` fell through the `switch`
 * silently (every connection config stayed `undefined`), and an unparsable numeric value became
 * `NaN` and was only caught much later, deep inside a driver. Both are now fail-fast at the moment
 * `database.ts` is imported (module load time).
 *
 * The validation must not narrow anything that already worked, so every case below that ACCEPTS a
 * value mirrors how `database.ts` parsed and the drivers used it before: an empty `DB_TYPE` still
 * means better-sqlite3, numbers keep `Number.parseInt` semantics ("5000ms" is 5000), 0 stays valid
 * wherever a driver accepted it (DB_SLOW_QUERY_LOGGING_TIMEOUT=0 turns the slow-query warning off),
 * and SQLite still ignores the pool/timeout variables it never used.
 *
 * Covered first as pure functions, then as `database.ts` module-load behavior via
 * `jest.isolateModules` — the same pattern `database-helpers.spec.ts` already uses, required because
 * `database.ts` computes its exports from `process.env` at import time, not per-call.
 */
describe('assertValidDatabaseType', () => {
	it.each(['sqlite', 'better-sqlite3', 'postgres', 'mysql'])('accepts the supported value %s', (value) => {
		expect(() => assertValidDatabaseType(value)).not.toThrow();
	});

	it('lets mongodb through, so database.ts can reject it with its own "not supported yet" error', () => {
		expect(() => assertValidDatabaseType('mongodb')).not.toThrow();
	});

	it('throws a descriptive error naming the bad value for an unrecognized DB_TYPE', () => {
		expect(() => assertValidDatabaseType('postgress')).toThrow(/Invalid DB_TYPE "postgress"/);
	});

	it('lists only the supported values in the error message, so a typo is easy to fix', () => {
		// mongodb is recognized but cannot run, so advertising it as a fix would only lead to the next error.
		expect(() => assertValidDatabaseType('bogus')).toThrow(
			new Error('Invalid DB_TYPE "bogus". Supported values: sqlite, better-sqlite3, postgres, mysql.')
		);
	});
});

describe('parseIntEnv', () => {
	it('returns the default when the variable is unset', () => {
		expect(parseIntEnv('DB_PORT', undefined, 5432)).toBe(5432);
	});

	it('returns the default when the variable is an empty string (how templates render an unset variable)', () => {
		expect(parseIntEnv('DB_PORT', '', 5432)).toBe(5432);
	});

	it('never validates the default, which is a literal in database.ts rather than user input', () => {
		expect(parseIntEnv('DB_IDLE_TIMEOUT', undefined, 0, { min: 1 })).toBe(0);
	});

	it('parses a plain integer', () => {
		expect(parseIntEnv('DB_PORT', '5433', 5432)).toBe(5433);
	});

	// database.ts always parsed these variables with Number.parseInt, so each of these values worked
	// and must keep meaning the same number.
	it.each([
		['+5', 5],
		[' 42 ', 42],
		['5000ms', 5000],
		['2.5', 2],
		['1e3', 1]
	])('parses %p to %p, exactly as Number.parseInt always did', (value, expected) => {
		expect(parseIntEnv('DB_CONNECTION_TIMEOUT', value, 2000)).toBe(expected);
	});

	it('keeps each call site\'s radix: "0x" is hexadecimal without a radix and stops the number at radix 10', () => {
		expect(parseIntEnv('DB_POOL_SIZE', '0x28', 40)).toBe(40);
		expect(parseIntEnv('DB_PORT', '0x28', 5432, { radix: 10 })).toBe(0);
	});

	it('accepts 0 by default', () => {
		expect(parseIntEnv('DB_SLOW_QUERY_LOGGING_TIMEOUT', '0', 10000)).toBe(0);
	});

	it.each(['abc', ' ', 'ms5000'])(
		'throws instead of silently returning NaN for %p, naming the variable and the value',
		(value) => {
			expect(() => parseIntEnv('DB_POOL_SIZE', value, 40)).toThrow(
				new Error(`Invalid DB_POOL_SIZE "${value}": expected an integer >= 0.`)
			);
		}
	);

	it('rejects a negative value by default', () => {
		expect(() => parseIntEnv('DB_POOL_SIZE', '-5', 40)).toThrow(
			new Error('Invalid DB_POOL_SIZE "-5": expected an integer >= 0.')
		);
	});

	it('rejects a value below a custom min', () => {
		expect(() => parseIntEnv('DB_IDLE_TIMEOUT', '0', 10000, { min: 1 })).toThrow(
			new Error('Invalid DB_IDLE_TIMEOUT "0": expected an integer >= 1.')
		);
	});
});

const DATABASE_ENV_KEYS = [
	'DB_TYPE',
	'DB_PATH',
	'DB_PORT',
	'DB_POOL_SIZE',
	'DB_POOL_SIZE_KNEX',
	'DB_CONNECTION_TIMEOUT',
	'DB_IDLE_TIMEOUT',
	'DB_SLOW_QUERY_LOGGING_TIMEOUT'
] as const;

type DatabaseEnv = Partial<Record<(typeof DATABASE_ENV_KEYS)[number], string>>;

/** The `database.ts` exports, loosely typed so the tests can reach driver-specific options. */
interface LoadedDatabaseConfig {
	dbTypeOrmConnectionConfig: Record<string, any>;
	dbMikroOrmConnectionConfig: Record<string, any>;
	dbKnexConnectionConfig: { config: Record<string, any> };
}

/**
 * Imports a fresh copy of `database.ts` with exactly the given database env vars set (every other
 * one in `DATABASE_ENV_KEYS` unset). Rethrows whatever the import throws.
 */
function loadDatabaseConfig(env: DatabaseEnv): LoadedDatabaseConfig {
	for (const key of DATABASE_ENV_KEYS) {
		if (env[key] === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = env[key];
		}
	}

	let loaded: LoadedDatabaseConfig;
	jest.isolateModules(() => {
		loaded = require('./database');
	});
	return loaded!;
}

describe('database.ts at import time', () => {
	const originalEnv = Object.fromEntries(DATABASE_ENV_KEYS.map((key) => [key, process.env[key]]));
	let consoleLog: jest.SpyInstance;

	beforeAll(() => {
		consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterAll(() => {
		consoleLog.mockRestore();
	});

	afterEach(() => {
		for (const key of DATABASE_ENV_KEYS) {
			if (originalEnv[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = originalEnv[key];
			}
		}
	});

	describe('DB_TYPE', () => {
		it('throws when DB_TYPE is a typo/unsupported value', () => {
			expect(() => loadDatabaseConfig({ DB_TYPE: 'postgress' })).toThrow(/Invalid DB_TYPE "postgress"/);
		});

		it('throws a real Error (not a bare string) for DB_TYPE=mongodb', () => {
			expect(() => loadDatabaseConfig({ DB_TYPE: 'mongodb' })).toThrow(
				new Error('DB_TYPE=mongodb is not supported yet.')
			);
		});

		// compose / k8s templates render an unset variable as '', so an empty DB_TYPE must keep
		// meaning "the default", exactly like an unset one.
		it.each([
			['unset', undefined],
			['empty', '']
		])('falls back to better-sqlite3 when DB_TYPE is %s', (_name, value) => {
			const { dbTypeOrmConnectionConfig, dbKnexConnectionConfig } = loadDatabaseConfig({
				DB_TYPE: value,
				DB_PATH: ':memory:'
			});
			expect(dbTypeOrmConnectionConfig.type).toBe('better-sqlite3');
			expect(dbKnexConnectionConfig.config.client).toBe('better-sqlite3');
		});
	});

	describe('pool, timeout and port settings', () => {
		// Values SQLite never read: an unparsable, a negative and a zero value of every kind.
		const valuesSqliteNeverUsed: DatabaseEnv = {
			DB_PORT: 'not-a-port',
			DB_POOL_SIZE: 'abc',
			DB_POOL_SIZE_KNEX: '-1',
			DB_CONNECTION_TIMEOUT: '0',
			DB_IDLE_TIMEOUT: 'soon',
			DB_SLOW_QUERY_LOGGING_TIMEOUT: 'never'
		};

		it.each(['sqlite', 'better-sqlite3'])('are ignored for DB_TYPE=%s, which never used them', (dbType) => {
			const { dbTypeOrmConnectionConfig } = loadDatabaseConfig({
				...valuesSqliteNeverUsed,
				DB_TYPE: dbType,
				DB_PATH: ':memory:'
			});
			expect(dbTypeOrmConnectionConfig.type).toBe('better-sqlite3');
		});

		it.each(['postgres', 'mysql'])(
			'reject an unparsable DB_POOL_SIZE for DB_TYPE=%s with a message naming the variable and value',
			(dbType) => {
				expect(() => loadDatabaseConfig({ DB_TYPE: dbType, DB_POOL_SIZE: 'abc' })).toThrow(
					new Error('Invalid DB_POOL_SIZE "abc": expected an integer >= 0.')
				);
			}
		);

		it.each(['postgres', 'mysql'])(
			'only warn about an unparsable DB_PORT for DB_TYPE=%s, which the drivers treated as the default port',
			(dbType) => {
				const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
				try {
					const { dbTypeOrmConnectionConfig } = loadDatabaseConfig({ DB_TYPE: dbType, DB_PORT: 'abc' });
					expect(Number.isNaN((dbTypeOrmConnectionConfig as { port?: number }).port)).toBe(true);
					expect(warn).toHaveBeenCalledWith(expect.stringContaining('Invalid DB_PORT "abc"'));
				} finally {
					warn.mockRestore();
				}
			}
		);

		it.each([
			['abc', NaN],
			['-5', -5]
		])(
			'only warn about DB_SLOW_QUERY_LOGGING_TIMEOUT=%s for DB_TYPE=postgres and keep the value as before',
			(value, expected) => {
				const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
				try {
					const { dbTypeOrmConnectionConfig } = loadDatabaseConfig({
						DB_TYPE: 'postgres',
						DB_SLOW_QUERY_LOGGING_TIMEOUT: value
					});
					expect(dbTypeOrmConnectionConfig.maxQueryExecutionTime).toBe(expected);
					expect(warn).toHaveBeenCalledWith(
						expect.stringContaining(`Invalid DB_SLOW_QUERY_LOGGING_TIMEOUT "${value}"`)
					);
				} finally {
					warn.mockRestore();
				}
			}
		);

		it('only warn about an unparsable timeout for DB_TYPE=postgres when no tarn pool reads it', () => {
			const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
			try {
				expect(() =>
					loadDatabaseConfig({
						DB_TYPE: 'postgres',
						DB_POOL_SIZE: '0',
						DB_POOL_SIZE_KNEX: '0',
						DB_IDLE_TIMEOUT: 'soon'
					})
				).not.toThrow();
				expect(warn).toHaveBeenCalledWith(expect.stringContaining('Invalid DB_IDLE_TIMEOUT "soon"'));
			} finally {
				warn.mockRestore();
			}
		});

		it.each(['postgres', 'mysql'])('reject a negative DB_POOL_SIZE_KNEX for DB_TYPE=%s', (dbType) => {
			expect(() => loadDatabaseConfig({ DB_TYPE: dbType, DB_POOL_SIZE_KNEX: '-1' })).toThrow(
				new Error('Invalid DB_POOL_SIZE_KNEX "-1": expected an integer >= 0.')
			);
		});

		it.each(['postgres', 'mysql'])(
			'accept DB_SLOW_QUERY_LOGGING_TIMEOUT=0 for DB_TYPE=%s, which turns the slow-query warning off',
			(dbType) => {
				const { dbTypeOrmConnectionConfig } = loadDatabaseConfig({
					DB_TYPE: dbType,
					DB_SLOW_QUERY_LOGGING_TIMEOUT: '0'
				});
				expect(dbTypeOrmConnectionConfig.maxQueryExecutionTime).toBe(0);
			}
		);

		it('parse loosely written numbers for DB_TYPE=postgres exactly as Number.parseInt did', () => {
			const { dbTypeOrmConnectionConfig, dbMikroOrmConnectionConfig, dbKnexConnectionConfig } =
				loadDatabaseConfig({
					DB_TYPE: 'postgres',
					DB_PORT: '5433/tcp',
					DB_POOL_SIZE: '+5',
					DB_POOL_SIZE_KNEX: '12 connections',
					DB_CONNECTION_TIMEOUT: '5000ms',
					DB_IDLE_TIMEOUT: ' 30000 ',
					DB_SLOW_QUERY_LOGGING_TIMEOUT: '2.5'
				});

			expect(dbTypeOrmConnectionConfig).toMatchObject({
				port: 5433,
				poolSize: 5,
				maxQueryExecutionTime: 2,
				extra: { max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 }
			});
			expect(dbMikroOrmConnectionConfig).toMatchObject({
				port: 5433,
				pool: { max: 5, acquireTimeoutMillis: 5000, idleTimeoutMillis: 30000 }
			});
			expect(dbKnexConnectionConfig.config).toMatchObject({
				connection: { port: 5433 },
				pool: { max: 12, acquireTimeoutMillis: 5000, idleTimeoutMillis: 30000 }
			});
		});

		it('parse loosely written numbers for DB_TYPE=mysql exactly as Number.parseInt did', () => {
			const { dbTypeOrmConnectionConfig, dbKnexConnectionConfig } = loadDatabaseConfig({
				DB_TYPE: 'mysql',
				DB_PORT: '3307',
				DB_POOL_SIZE: '+5',
				DB_CONNECTION_TIMEOUT: '5000ms'
			});

			expect(dbTypeOrmConnectionConfig).toMatchObject({ port: 3307, poolSize: 5, extra: { connectionLimit: 5 } });
			expect(dbKnexConnectionConfig.config).toMatchObject({
				connection: { port: 3307 },
				pool: { acquireTimeoutMillis: 5000 }
			});
		});

		// knex creates no pool for max 0, pg-pool then falls back to 10 and mysql2 treats 0 as "no limit".
		it.each(['postgres', 'mysql'])('accept a pool size of 0 for DB_TYPE=%s, as the drivers did', (dbType) => {
			const { dbTypeOrmConnectionConfig, dbKnexConnectionConfig } = loadDatabaseConfig({
				DB_TYPE: dbType,
				DB_POOL_SIZE: '0',
				DB_POOL_SIZE_KNEX: '0'
			});
			expect(dbTypeOrmConnectionConfig.poolSize).toBe(0);
			expect(dbKnexConnectionConfig.config.pool.max).toBe(0);
		});

		// tarn (behind the Knex and MikroORM pools) refused a 0 timeout at startup, so it is still rejected,
		// now with a clear message instead of a tarn error.
		it.each([
			['postgres', 'DB_CONNECTION_TIMEOUT'],
			['postgres', 'DB_IDLE_TIMEOUT'],
			['mysql', 'DB_CONNECTION_TIMEOUT'],
			['mysql', 'DB_IDLE_TIMEOUT']
		])('reject 0 for DB_TYPE=%s %s while a pool will be created', (dbType, name) => {
			expect(() => loadDatabaseConfig({ DB_TYPE: dbType, [name]: '0' })).toThrow(
				new Error(`Invalid ${name} "0": expected an integer >= 1.`)
			);
		});

		it('still reject a 0 timeout for DB_TYPE=postgres when only the Knex pool is disabled (MikroORM uses it)', () => {
			expect(() =>
				loadDatabaseConfig({ DB_TYPE: 'postgres', DB_POOL_SIZE_KNEX: '0', DB_CONNECTION_TIMEOUT: '0' })
			).toThrow(/Invalid DB_CONNECTION_TIMEOUT "0"/);
		});

		it('accept 0 timeouts when no pool that validates them is created', () => {
			// MySQL: the MikroORM pool gets no timeouts, so disabling the Knex pool is enough.
			expect(() =>
				loadDatabaseConfig({
					DB_TYPE: 'mysql',
					DB_POOL_SIZE_KNEX: '0',
					DB_CONNECTION_TIMEOUT: '0',
					DB_IDLE_TIMEOUT: '0'
				})
			).not.toThrow();

			// PostgreSQL: with the Knex and MikroORM pools both disabled only pg-pool reads the timeouts,
			// where 0 means "no timeout".
			const { dbTypeOrmConnectionConfig } = loadDatabaseConfig({
				DB_TYPE: 'postgres',
				DB_POOL_SIZE: '0',
				DB_POOL_SIZE_KNEX: '0',
				DB_CONNECTION_TIMEOUT: '0',
				DB_IDLE_TIMEOUT: '0'
			});
			expect(dbTypeOrmConnectionConfig.extra).toMatchObject({ connectionTimeoutMillis: 0, idleTimeoutMillis: 0 });
		});
	});
});
