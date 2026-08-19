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
