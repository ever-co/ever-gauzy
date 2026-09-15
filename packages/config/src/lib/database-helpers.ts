import { TlsOptions } from 'tls';
import type { DataSourceOptions } from 'typeorm';

export type MikroLoggerNamespace = 'query' | 'query-params' | 'schema' | 'discovery' | 'info';

/**
 * How TypeORM treats `null` and `undefined` values inside `find*` / `count*` / `exists*` and
 * `update` / `delete` / `softDelete` criteria (`where`) objects. TypeORM ≥ 1.0 defaults both to
 * `'throw'`; this is the ONE place the application overrides that, and every TypeORM connection
 * profile in `database.ts` must use it.
 *
 * - `undefined: 'ignore'` — an `undefined` value omits the key. That is the optional-filter idiom
 *   used throughout the codebase (`where: { tenantId, organizationId }` where `organizationId` may
 *   legitimately be undefined) and matches TypeORM 0.3.
 * - `null: 'sql-null'` — a `null` value emits `"column" IS NULL` (columns and relations alike),
 *   i.e. TypeORM ≤ 0.2 and MikroORM semantics, so a `where` object shared by both ORM branches
 *   means the same thing on both.
 *
 * `null` MUST NEVER be `'ignore'`. That silently drops the predicate, so a lookup such as
 * `{ tenantId: null, organizationId: null }` (meaning "the global, tenant-less row") matches EVERY
 * tenant's rows — a cross-tenant data-isolation failure (GHSA-44pv-34gx-q9p4). `'sql-null'` is
 * fail-closed: a null can only ever narrow a query, never widen it. Application code should still
 * spell the intent out with the explicit `IsNull()` operator; this setting is the safety net for
 * anything that does not.
 */
export const TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR: NonNullable<DataSourceOptions['invalidWhereValuesBehavior']> =
	Object.freeze({ null: 'sql-null', undefined: 'ignore' } as const);

export enum DatabaseTypeEnum {
	mongodb = 'mongodb',
	sqlite = 'sqlite',
	betterSqlite3 = 'better-sqlite3',
	postgres = 'postgres',
	mysql = 'mysql'
}

const isMysqlValue = process.env.DB_TYPE === DatabaseTypeEnum.mysql;
const isSqliteValue = process.env.DB_TYPE === DatabaseTypeEnum.sqlite;
const isBetterSqlite3Value = process.env.DB_TYPE === DatabaseTypeEnum.betterSqlite3;
const isPostgresValue = process.env.DB_TYPE === DatabaseTypeEnum.postgres;
const isMongodbValue = process.env.DB_TYPE === DatabaseTypeEnum.mongodb;

export const isMySQL = (): boolean => isMysqlValue;
export const isSqlite = (): boolean => isSqliteValue;
export const isBetterSqlite3 = (): boolean => isBetterSqlite3Value;
export const isPostgres = (): boolean => isPostgresValue;
export const isMongodb = (): boolean => isMongodbValue;

const DATABASE_TYPE_VALUES: readonly string[] = Object.values(DatabaseTypeEnum);

/**
 * Validates that a `DB_TYPE` value is one of the values `DatabaseTypeEnum` supports — TASK 5
 * (Configuration Schema and Startup Validation) of the improvement roadmap.
 *
 * Before this existed, `database.ts`'s `switch (dbType)` had no `default` case: an unrecognized
 * value (a typo, an unsupported engine) fell through silently, leaving `dbTypeOrmConnectionConfig`/
 * `dbMikroOrmConnectionConfig`/`dbKnexConnectionConfig` all `undefined` — a startup misconfiguration
 * that would only surface later as an opaque "Cannot read properties of undefined" deep inside
 * `TypeOrmModule.forRootAsync`, rather than a clear error at the moment the bad config is read.
 *
 * @param dbType - The `DB_TYPE` value to validate (already defaulted by the caller when unset —
 *   this only rejects a value that was actually SET to something unrecognized).
 * @throws {Error} if `dbType` is not one of `DatabaseTypeEnum`'s values.
 */
export function assertValidDatabaseType(dbType: string): asserts dbType is DatabaseTypeEnum {
	if (!DATABASE_TYPE_VALUES.includes(dbType)) {
		throw new Error(
			`Invalid DB_TYPE "${dbType}". Supported values: ${DATABASE_TYPE_VALUES.join(', ')}.`
		);
	}
}

/**
 * Parses a positive-integer environment variable, failing fast with a descriptive error instead of
 * silently producing `NaN` — which every downstream pool/timeout option in `database.ts` previously
 * accepted without complaint until it broke a connection much later, deep inside a driver.
 *
 * @param name - The environment variable's name, used only for the error message.
 * @param rawValue - `process.env[name]`.
 * @param defaultValue - Used when `rawValue` is unset or empty; never itself validated, since it is
 *   a literal in `database.ts`, not user input.
 * @throws {Error} if `rawValue` is set but does not parse to a positive integer.
 */
export function parsePositiveIntEnv(name: string, rawValue: string | undefined, defaultValue: number): number {
	if (rawValue === undefined || rawValue === '') {
		return defaultValue;
	}
	// `Number.parseInt` parses only a leading numeric PREFIX — "2.5" silently becomes 2 and
	// "5432junk" silently becomes 5432, defeating the whole point of failing fast on a
	// misconfigured value. Require the entire string to be digits (a real review finding on this
	// PR — see database-config-validation.spec.ts's dedicated tests for both cases).
	if (!/^\d+$/.test(rawValue.trim())) {
		throw new Error(`Invalid ${name} "${rawValue}": expected a positive integer.`);
	}
	const parsed = Number.parseInt(rawValue, 10);
	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new Error(`Invalid ${name} "${rawValue}": expected a positive integer.`);
	}
	return parsed;
}

/**
 * Gets TLS options for a database connection based on the provided SSL mode.
 *
 * @param {boolean} dbSslMode - The SSL mode for the database connection.
 * @returns {TlsOptions | undefined} - TLS options for the database connection or undefined if SSL is disabled.
 */
export const getTlsOptions = (dbSslMode: boolean): TlsOptions | undefined => {
	// Check if SSL is enabled based on the provided SSL mode
	if (!dbSslMode) {
		// If SSL is not enabled, return undefined
		return undefined;
	}

	// Obtain the CA certificate from the environment variable and decode it
	const base64data = process.env.DB_CA_CERT;
	if (!base64data) {
		// Handle the case where DB_CA_CERT is not defined
		console.error('DB_CA_CERT is not defined. TLS options cannot be configured.');
		return undefined;
	}

	try {
		const buff = Buffer.from(base64data, 'base64');
		const sslCert = buff.toString('ascii');

		// Return TLS options with the decoded CA certificate
		return {
			rejectUnauthorized: true, // You might want to make this configurable
			ca: sslCert
		};
	} catch (error) {
		// Handle decoding errors
		console.error('Error decoding DB_CA_CERT:', error instanceof Error ? (error.stack || error.message) : String(error));
		return undefined;
	}
};

/**
 * Get logging options based on the provided dbLogging value.
 * @param {string} dbLogging - The value of process.env.DB_LOGGING
 * @returns {false | 'all' | ['query', 'error'] | ['error']} - The logging options
 */
export const getLoggingOptions = (dbLogging: string): false | 'all' | ['query', 'error'] | ['error'] => {
	let loggingOptions: false | 'all' | ['query', 'error'] | ['error'];
	switch (dbLogging) {
		case 'false':
			loggingOptions = false;
			break;
		case 'all':
			loggingOptions = 'all';
			break;
		case 'query':
			loggingOptions = ['query', 'error'];
			break;
		default:
			loggingOptions = ['error'];
	}
	return loggingOptions;
};

/**
 * Gets MikroORM logging options based on the specified logging type.
 *
 * @param dbLogging - The logging type.
 * @returns False if logging is disabled, or an array of LoggerNamespace for the specified logging type.
 */
export const getLoggingMikroOptions = (dbLogging: string): false | MikroLoggerNamespace[] => {
	const loggingOptionsMap: Record<string, MikroLoggerNamespace[]> = {
		query: ['query'],
		'query-params': ['query-params'],
		schema: ['schema'],
		discovery: ['discovery'],
		info: ['info'],
		all: ['query', 'query-params', 'schema', 'discovery', 'info']
	};

	return loggingOptionsMap[dbLogging] || false;
};
