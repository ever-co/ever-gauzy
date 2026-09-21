import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { MikroOrmModuleOptions } from '@mikro-orm/nestjs';
import { EntityCaseNamingStrategy } from '@mikro-orm/core';
import { SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { BetterSqliteDriver, Options as MikroOrmBetterSqliteOptions } from '@mikro-orm/better-sqlite';
import { PostgreSqlDriver, Options as MikroOrmPostgreSqlOptions } from '@mikro-orm/postgresql';
import { Options as MikroOrmMySqlOptions, MySqlDriver } from '@mikro-orm/mysql';
import { DataSourceOptions } from 'typeorm';
import { KnexModuleOptions } from 'nest-knexjs';
import * as path from 'path';
import * as chalk from 'chalk';
import {
	assertValidDatabaseType,
	DatabaseTypeEnum,
	getLoggingMikroOptions,
	getLoggingOptions,
	getTlsOptions,
	parseIntEnv,
	TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
} from './database-helpers';

/**
 * Type representing the ORM types.
 */
export type MultiORM = 'typeorm' | 'mikro-orm';

/**
 * Enum representing different ORM types.
 */
enum MultiORMEnum {
	TypeORM = 'typeorm',
	MikroORM = 'mikro-orm'
}

/**
 * Gets the ORM type from the environment variable or returns the default value.
 *
 * @param {MultiORM} [defaultValue=MultiORMEnum.TypeORM] - The default ORM type if not specified in the environment variable.
 * @returns {MultiORM} - The ORM type.
 */
function getORMType(defaultValue: MultiORM = MultiORMEnum.TypeORM): MultiORM {
	return (process.env.DB_ORM as MultiORM) || defaultValue;
}

console.log(chalk.magenta(`NodeJs Version %s`), process.version);
console.log('Is DEMO: %s', process.env.DEMO);
console.log('NODE_ENV: %s', process.env.NODE_ENV);

const dbORM: MultiORM = getORMType();
console.log('DB ORM: %s', dbORM);

// `||`, not `??`: an empty DB_TYPE falls back to better-sqlite3 exactly like an unset one, because
// compose / k8s templates render an unset variable as ''.
const dbType = process.env.DB_TYPE || DatabaseTypeEnum.betterSqlite3;
// Fail fast on a typo'd/unsupported DB_TYPE instead of letting the switch below fall through
// silently and leave every connection config `undefined` (TASK 5 finding).
assertValidDatabaseType(dbType);

console.log(`Selected DB Type (DB_TYPE env var): ${dbType}`);
console.log('DB Synchronize: ' + process.env.DB_SYNCHRONIZE);

let typeOrmConnectionConfig: TypeOrmModuleOptions;
let mikroOrmConnectionConfig: MikroOrmModuleOptions;
let knexConnectionConfig: KnexModuleOptions;

/**
 * Connection pool sizes and timeouts of the networked databases (PostgreSQL / MySQL).
 */
interface ConnectionPoolSettings {
	dbPoolSize: number;
	dbPoolSizeKnex: number;
	dbConnectionTimeout: number;
	idleTimeoutMillis: number;
	dbSlowQueryLoggingTimeout: number;
}

/**
 * Reads the connection pool sizes and timeouts from the environment. Only the PostgreSQL and MySQL
 * branches below call this: SQLite never used any of these settings, so a value it ignored must not
 * abort its startup.
 *
 * Each setting keeps the `Number.parseInt` semantics (see `parseIntEnv`). A value that does not parse
 * (`NaN`) or is negative throws, and so does a 0 timeout that tarn refused at startup anyway (see
 * below); every other number is passed on exactly as before.
 *
 * @param type - The networked database being configured.
 * @returns The parsed settings.
 * @throws {Error} naming the variable and its value when a setting is invalid.
 */
function readConnectionPoolSettings(type: DatabaseTypeEnum.postgres | DatabaseTypeEnum.mysql): ConnectionPoolSettings {
	// We set default pool size as 40. Usually PG has 100 connections max by default.
	// 0 stays valid: knex (which MikroORM runs on) creates no pool for max 0, pg-pool then falls back
	// to 10 connections and mysql2 treats 0 as "no limit".
	const poolSize = parseIntEnv('DB_POOL_SIZE', process.env.DB_POOL_SIZE, 40);

	// For now we limit Knex to 10 connections max because it's only used in few places and we don't want to overload the DB.
	// 0 stays valid for the same reason: knex then creates no pool.
	const knexPoolSize = parseIntEnv('DB_POOL_SIZE_KNEX', process.env.DB_POOL_SIZE_KNEX, 10);

	// Reduce connection timeout in development to fail faster and avoid long startup delays
	const defaultConnectionTimeout = process.env.NODE_ENV === 'production' ? 5000 : 2000; // 2 seconds for dev, 5 seconds for prod

	// tarn, the pool behind knex and MikroORM, refuses to start with a timeout that is not > 0. It only
	// sees the timeouts when a pool is created: the Knex pool, or the MikroORM pool on PostgreSQL (the
	// MySQL one gets no timeouts). With both of those disabled only pg-pool reads them, and there 0
	// means "no timeout", so 0 stays valid in that case.
	const timeoutsReachTarn = knexPoolSize !== 0 || (type === DatabaseTypeEnum.postgres && poolSize !== 0);
	const minTimeout = timeoutsReachTarn ? 1 : 0;

	// With no tarn pool an unparsable or negative timeout never stopped startup (pg-pool ignored it), so it only
	// warns there; where tarn sees it, it already crashed startup and now fails with a readable error instead.
	const onInvalidTimeout = timeoutsReachTarn ? 'throw' : 'warn';

	const connectionTimeout = parseIntEnv(
		'DB_CONNECTION_TIMEOUT',
		process.env.DB_CONNECTION_TIMEOUT,
		defaultConnectionTimeout,
		{ min: minTimeout, onInvalid: onInvalidTimeout }
	);

	const idleTimeout = parseIntEnv('DB_IDLE_TIMEOUT', process.env.DB_IDLE_TIMEOUT, 10000, {
		min: minTimeout,
		onInvalid: onInvalidTimeout
	}); // 10 seconds

	// 0 turns TypeORM's slow-query warning off: it only logs when maxQueryExecutionTime is truthy. An
	// unparsable value also switched it off and a negative one logged every query, but neither stopped
	// startup, so both only warn.
	const slowQueryLoggingTimeout = parseIntEnv(
		'DB_SLOW_QUERY_LOGGING_TIMEOUT',
		process.env.DB_SLOW_QUERY_LOGGING_TIMEOUT,
		10000, // 10 seconds default
		{ onInvalid: 'warn' }
	);

	console.log('DB ORM Pool Size: ' + poolSize);
	console.log('DB Knex Pool Size: ' + knexPoolSize);

	console.log('DB Connection Timeout: ' + connectionTimeout);
	console.log('DB Idle Timeout: ' + idleTimeout);
	console.log('DB Slow Query Logging Timeout: ' + slowQueryLoggingTimeout);

	return {
		dbPoolSize: poolSize,
		dbPoolSizeKnex: knexPoolSize,
		dbConnectionTimeout: connectionTimeout,
		idleTimeoutMillis: idleTimeout,
		dbSlowQueryLoggingTimeout: slowQueryLoggingTimeout
	};
}

/**
 * Prints the same five pool/timeout startup lines as `readConnectionPoolSettings` for SQLite, which never
 * uses these settings. The values are parsed with plain `Number.parseInt` and are never validated, so a
 * value SQLite ignores can never abort its startup: an unparsable one prints as `NaN`, as it always did.
 */
function logConnectionPoolSettingsUnvalidated(): void {
	const poolSize = process.env.DB_POOL_SIZE ? Number.parseInt(process.env.DB_POOL_SIZE) : 40;
	const knexPoolSize = process.env.DB_POOL_SIZE_KNEX ? Number.parseInt(process.env.DB_POOL_SIZE_KNEX) : 10;
	const defaultConnectionTimeout = process.env.NODE_ENV === 'production' ? 5000 : 2000;
	const connectionTimeout = process.env.DB_CONNECTION_TIMEOUT
		? Number.parseInt(process.env.DB_CONNECTION_TIMEOUT)
		: defaultConnectionTimeout;
	const idleTimeout = process.env.DB_IDLE_TIMEOUT ? Number.parseInt(process.env.DB_IDLE_TIMEOUT) : 10000;
	const slowQueryLoggingTimeout = process.env.DB_SLOW_QUERY_LOGGING_TIMEOUT
		? Number.parseInt(process.env.DB_SLOW_QUERY_LOGGING_TIMEOUT)
		: 10000;

	console.log('DB ORM Pool Size: ' + poolSize);
	console.log('DB Knex Pool Size: ' + knexPoolSize);

	console.log('DB Connection Timeout: ' + connectionTimeout);
	console.log('DB Idle Timeout: ' + idleTimeout);
	console.log('DB Slow Query Logging Timeout: ' + slowQueryLoggingTimeout);
}

// Assigned by the PostgreSQL / MySQL branches of the switch below (see readConnectionPoolSettings).
let dbPoolSize: number;
let dbPoolSizeKnex: number;
let dbConnectionTimeout: number;
let idleTimeoutMillis: number;
let dbSlowQueryLoggingTimeout: number;

const dbSslMode = process.env.DB_SSL_MODE === 'true';

console.log('DB SSL Mode: ' + process.env.DB_SSL_MODE);
console.log('DB SSL MODE ENABLE: ' + dbSslMode);

switch (dbType) {
	case DatabaseTypeEnum.mongodb:
		// A real Error, not a bare string: `throw`ing a string loses the stack trace and fails
		// `instanceof Error` checks anywhere upstream that might otherwise handle this gracefully.
		throw new Error('DB_TYPE=mongodb is not supported yet.');

	case DatabaseTypeEnum.mysql:
		// Read here rather than at module level so SQLite never validates them (see readConnectionPoolSettings).
		// DB_PORT below accepts 0 as before: like an unset port, it makes every driver use its default port.
		({ dbPoolSize, dbPoolSizeKnex, dbConnectionTimeout, idleTimeoutMillis, dbSlowQueryLoggingTimeout } =
			readConnectionPoolSettings(dbType));

		// MikroORM DB Config (MySQL)
		const mikroOrmMySqlOptions: MikroOrmMySqlOptions = {
			driver: MySqlDriver,
			host: process.env.DB_HOST || 'localhost',
			port: parseIntEnv('DB_PORT', process.env.DB_PORT, 3306, { radix: 10, onInvalid: 'warn' }),
			dbName: process.env.DB_NAME || 'mysql',
			user: process.env.DB_USER || 'root',
			password: process.env.DB_PASS || 'root',
			migrations: {
				path: 'src/modules/not-exists/*.migration{.ts,.js}'
			},
			entities: ['src/modules/not-exists/*.entity{.ts,.js}'],
			driverOptions: {
				connection: {
					ssl: getTlsOptions(dbSslMode)
				}
			},
			pool: {
				min: 0,
				max: dbPoolSize
			},
			persistOnCreate: true,
			extensions: [SoftDeleteHandler],
			namingStrategy: EntityCaseNamingStrategy,
			debug: getLoggingMikroOptions(process.env.DB_LOGGING) // by default set to false only
		};
		mikroOrmConnectionConfig = mikroOrmMySqlOptions;

		// TypeORM DB Config (MySQL)
		const typeOrmMySqlOptions: DataSourceOptions = {
			type: dbType,
			// null -> IS NULL, undefined -> key omitted. Never 'ignore' for null (GHSA-44pv-34gx-q9p4); see database-helpers.ts.
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR,
			ssl: getTlsOptions(dbSslMode),
			host: process.env.DB_HOST || 'localhost',
			port: parseIntEnv('DB_PORT', process.env.DB_PORT, 3306, { radix: 10, onInvalid: 'warn' }),
			database: process.env.DB_NAME || 'mysql',
			username: process.env.DB_USER || 'root',
			password: process.env.DB_PASS || 'root',
			// forcing typeorm to use (mysql2) if both (mysql/mysql2) packages found, it prioritize to load (mysql)
			logging: getLoggingOptions(process.env.DB_LOGGING), // by default set to error only
			logger: 'advanced-console',
			// log queries that take more than 10 sec as warnings
			maxQueryExecutionTime: dbSlowQueryLoggingTimeout,
			synchronize: process.env.DB_SYNCHRONIZE === 'true', // We are using migrations, synchronize should be set to false.
			poolSize: dbPoolSize,
			migrations: ['src/modules/not-exists/*.migration{.ts,.js}'],
			entities: ['src/modules/not-exists/*.entity{.ts,.js}'],
			extra: {
				connectionLimit: dbPoolSize,
				maxIdle: dbPoolSize
			}
		};
		typeOrmConnectionConfig = typeOrmMySqlOptions;

		// Get TLS (Transport Layer Security) options based on the specified SSL mode.
		const tlsMySqlOptions = getTlsOptions(dbSslMode);

		// Knex DB Config (MySQL)
		const knexMySqlOptions: KnexModuleOptions = {
			config: {
				client: 'mysql2', // Database client (MySQL in this case)
				connection: {
					ssl: tlsMySqlOptions
						? { ca: tlsMySqlOptions.ca, rejectUnauthorized: tlsMySqlOptions.rejectUnauthorized }
						: false,
					host: process.env.DB_HOST || 'localhost', // Database host (default: localhost)
					port: parseIntEnv('DB_PORT', process.env.DB_PORT, 3306, { radix: 10, onInvalid: 'warn' }), // Database port (default: 3306)
					database: process.env.DB_NAME || 'mysql', // Database name (default: mysql)
					user: process.env.DB_USER || 'root', // Database username (default: mysql)
					password: process.env.DB_PASS || 'root' // Database password (default: root)
				},
				// Connection pool settings
				pool: {
					min: 0, // Minimum number of connections in the pool
					max: dbPoolSizeKnex, // Maximum number of connections in the pool
					// Number of milliseconds a client must sit idle in the pool
					// before it is disconnected from the backend and discarded
					idleTimeoutMillis: idleTimeoutMillis,
					// Connection timeout - number of milliseconds to wait before timing out
					// when connecting a new client
					acquireTimeoutMillis: dbConnectionTimeout
				},
				useNullAsDefault: true // Specify whether to use null as the default for unspecified fields
			}
		};

		knexConnectionConfig = knexMySqlOptions;

		break;

	case DatabaseTypeEnum.postgres:
		// Read here rather than at module level so SQLite never validates them (see readConnectionPoolSettings).
		// DB_PORT below accepts 0 as before: like an unset port, it makes every driver use its default port.
		({ dbPoolSize, dbPoolSizeKnex, dbConnectionTimeout, idleTimeoutMillis, dbSlowQueryLoggingTimeout } =
			readConnectionPoolSettings(dbType));

		// MikroORM DB Config (PostgreSQL)
		const mikroOrmPostgresOptions: MikroOrmPostgreSqlOptions = {
			driver: PostgreSqlDriver,
			host: process.env.DB_HOST || 'localhost',
			port: parseIntEnv('DB_PORT', process.env.DB_PORT, 5432, { radix: 10, onInvalid: 'warn' }),
			dbName: process.env.DB_NAME || 'postgres',
			user: process.env.DB_USER || 'postgres',
			password: process.env.DB_PASS || 'root',
			migrations: {
				path: 'src/modules/not-exists/*.migration{.ts,.js}'
			},
			entities: ['src/modules/not-exists/*.entity{.ts,.js}'],
			driverOptions: {
				connection: {
					ssl: getTlsOptions(dbSslMode)
				}
			},
			pool: {
				min: 0,
				max: dbPoolSize,
				// number of milliseconds a client must sit idle in the pool and not be checked out
				// before it is disconnected from the backend and discarded
				idleTimeoutMillis: idleTimeoutMillis,
				// connection timeout - number of milliseconds to wait before timing out when connecting a new client
				acquireTimeoutMillis: dbConnectionTimeout
			},
			persistOnCreate: true,
			extensions: [SoftDeleteHandler],
			namingStrategy: EntityCaseNamingStrategy,
			debug: getLoggingMikroOptions(process.env.DB_LOGGING) // by default set to false only
		};
		mikroOrmConnectionConfig = mikroOrmPostgresOptions;

		// TypeORM DB Config (PostgreSQL)
		const typeOrmPostgresOptions: DataSourceOptions = {
			type: dbType,
			// null -> IS NULL, undefined -> key omitted. Never 'ignore' for null (GHSA-44pv-34gx-q9p4); see database-helpers.ts.
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR,
			ssl: getTlsOptions(dbSslMode),
			host: process.env.DB_HOST || 'localhost',
			port: parseIntEnv('DB_PORT', process.env.DB_PORT, 5432, { radix: 10, onInvalid: 'warn' }),
			database: process.env.DB_NAME || 'postgres',
			username: process.env.DB_USER || 'postgres',
			password: process.env.DB_PASS || 'root',
			logging: getLoggingOptions(process.env.DB_LOGGING), // by default set to error only
			logger: 'advanced-console',
			// log queries that take more than 10 sec as warnings
			maxQueryExecutionTime: dbSlowQueryLoggingTimeout,
			synchronize: process.env.DB_SYNCHRONIZE === 'true', // We are using migrations, synchronize should be set to false.
			uuidExtension: 'pgcrypto',
			migrations: ['src/modules/not-exists/*.migration{.ts,.js}'],
			entities: ['src/modules/not-exists/*.entity{.ts,.js}'],
			// See https://typeorm.io/data-source-options#common-data-source-options
			poolSize: dbPoolSize,
			extra: {
				// based on  https://node-postgres.com/api/pool max connection pool size
				max: dbPoolSize,
				minConnection: 0,
				maxConnection: dbPoolSize,
				poolSize: dbPoolSize,
				// connection timeout - number of milliseconds to wait before timing out when connecting a new client
				connectionTimeoutMillis: dbConnectionTimeout,
				// number of milliseconds a client must sit idle in the pool and not be checked out
				// before it is disconnected from the backend and discarded
				idleTimeoutMillis: idleTimeoutMillis
			}
		};
		typeOrmConnectionConfig = typeOrmPostgresOptions;

		// Get TLS (Transport Layer Security) options based on the specified SSL mode.
		const tlsPostgresOptions = getTlsOptions(dbSslMode);

		// Knex DB Config (PostgreSQL)
		const knexPostgresOptions: KnexModuleOptions = {
			config: {
				client: 'pg', // Database client (PostgreSQL in this case)
				connection: {
					ssl: tlsPostgresOptions
						? { ca: tlsPostgresOptions.ca, rejectUnauthorized: tlsPostgresOptions.rejectUnauthorized }
						: false,
					host: process.env.DB_HOST || 'localhost', // Database host (default: localhost)
					port: parseIntEnv('DB_PORT', process.env.DB_PORT, 5432, { radix: 10, onInvalid: 'warn' }), // Database port (default: 5432)
					database: process.env.DB_NAME || 'postgres', // Database name (default: postgres)
					user: process.env.DB_USER || 'postgres', // Database username (default: postgres)
					password: process.env.DB_PASS || 'root' // Database password (default: root)
				},
				// Connection pool settings
				pool: {
					min: 0, // Minimum number of connections in the pool
					max: dbPoolSizeKnex, // Maximum number of connections in the pool
					// Number of milliseconds a client must sit idle in the pool
					// before it is disconnected from the backend and discarded
					idleTimeoutMillis: idleTimeoutMillis,
					// Connection timeout - number of milliseconds to wait before timing out
					// when connecting a new client
					acquireTimeoutMillis: dbConnectionTimeout
				},
				useNullAsDefault: true // Specify whether to use null as the default for unspecified fields
			}
		};

		knexConnectionConfig = knexPostgresOptions;

		break;

	case DatabaseTypeEnum.sqlite:
	case DatabaseTypeEnum.betterSqlite3:
		// SQLite never uses the pool/timeout settings and must not validate them, but they are still printed
		// at startup like for every other DB_TYPE (see logConnectionPoolSettingsUnvalidated).
		logConnectionPoolSettingsUnvalidated();

		// Determine if running from dist or source
		const isDist = __dirname.includes('dist');

		console.log('Better Sqlite3 Path isDist: ->', isDist);
		console.log('Better Sqlite3 Path process.cwd(): ->', process.cwd());
		console.log('Better Sqlite3 Path __dirname: ->', __dirname);

		const dbPath = isDist
			? path.resolve(process.cwd(), 'apps/api/data/gauzy.sqlite3') // For dist structure
			: path.resolve(__dirname, '../../../../apps/api/data/gauzy.sqlite3'); // For src structure

		const sqlitePath = process.env.DB_PATH || dbPath;
		console.log('Better Sqlite DB Path: ' + sqlitePath);

		// MikroORM DB Config (Better-SQLite3)
		const mikroOrmBetterSqliteConfig: MikroOrmBetterSqliteOptions = {
			driver: BetterSqliteDriver,
			dbName: sqlitePath,
			persistOnCreate: true,
			extensions: [SoftDeleteHandler],
			namingStrategy: EntityCaseNamingStrategy,
			debug: getLoggingMikroOptions(process.env.DB_LOGGING) // by default set to false only
		};
		mikroOrmConnectionConfig = mikroOrmBetterSqliteConfig;

		// TypeORM DB Config (Better-SQLite3)
		const typeOrmBetterSqliteConfig: DataSourceOptions = {
			type: DatabaseTypeEnum.betterSqlite3,
			// null -> IS NULL, undefined -> key omitted. Never 'ignore' for null (GHSA-44pv-34gx-q9p4); see database-helpers.ts.
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR,
			database: sqlitePath,
			logging: getLoggingOptions(process.env.DB_LOGGING),
			logger: 'file', // Removes console logging, instead logs all queries in a file ormlogs.log
			synchronize: process.env.DB_SYNCHRONIZE === 'true', // We are using migrations, synchronize should be set to false.
			prepareDatabase: (db) => {
				if (!process.env.IS_ELECTRON) {
					// Enhance performance
					db.pragma('journal_mode = WAL');
				}
			}
		};
		typeOrmConnectionConfig = typeOrmBetterSqliteConfig;

		// Knex DB Config (Better-SQLite3)
		const knexBetterSqliteConfig: KnexModuleOptions = {
			config: {
				client: 'better-sqlite3',
				connection: {
					filename: sqlitePath
				},
				useNullAsDefault: true // Specify whether to use null as the default for unspecified fields
			}
		};
		knexConnectionConfig = knexBetterSqliteConfig;

		break;
}

/**
 * TypeORM DB connection configuration.
 */
export const dbTypeOrmConnectionConfig = typeOrmConnectionConfig;

/**
 * MikroORM DB connection configuration.
 */
export const dbMikroOrmConnectionConfig = mikroOrmConnectionConfig;

/**
 * Knex DB connection configuration.
 */
export const dbKnexConnectionConfig = knexConnectionConfig;
