import * as path from 'path';
import * as chalk from 'chalk';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { MikroOrmModuleOptions } from '@mikro-orm/nestjs';
import { EntityCaseNamingStrategy } from '@mikro-orm/core';
import { SqliteDriver, Options as MikroOrmSqliteOptions } from '@mikro-orm/sqlite';
import { BetterSqliteDriver, Options as MikroOrmBetterSqliteOptions } from '@mikro-orm/better-sqlite';
import { PostgreSqlDriver, Options as MikroOrmPostgreSqlOptions } from '@mikro-orm/postgresql';
import { Options as MikroOrmMySqlOptions, MySqlDriver } from '@mikro-orm/mysql';
import { DataSourceOptions } from 'typeorm';
import { KnexModuleOptions } from 'nest-knexjs';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';
import { DatabaseTypeEnum, getLoggingOptions, getTlsOptions } from './database-helpers';

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
console.log('Is DEMO: ', process.env.DEMO);
console.log('NODE_ENV: ', process.env.NODE_ENV);

const dbORM: MultiORM = getORMType();
console.log('DB ORM: ' + dbORM);

const dbType = process.env.DB_TYPE || DatabaseTypeEnum.betterSqlite3;

console.log(`Selected DB Type (DB_TYPE env var): ${dbType}`);
console.log('DB Synchronize: ' + process.env.DB_SYNCHRONIZE);

let typeOrmConnectionConfig: TypeOrmModuleOptions;
let mikroOrmConnectionConfig: MikroOrmModuleOptions;
let knexConnectionConfig: KnexModuleOptions;

// We set default pool size as 80. Usually PG has 100 connections max by default.
const dbPoolSize = process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE) : 80;
const dbConnectionTimeout = process.env.DB_CONNECTION_TIMEOUT ? parseInt(process.env.DB_CONNECTION_TIMEOUT) : 5000; // 5 seconds default
const idleTimeoutMillis = process.env.DB_IDLE_TIMEOUT ? parseInt(process.env.DB_IDLE_TIMEOUT) : 10000; // 10 seconds
const dbSlowQueryLoggingTimeout = process.env.DB_SLOW_QUERY_LOGGING_TIMEOUT ? parseInt(process.env.DB_SLOW_QUERY_LOGGING_TIMEOUT) : 10000; // 10 seconds default
const dbSslMode = process.env.DB_SSL_MODE === 'true';

// Get TLS (Transport Layer Security) options based on the specified SSL mode.
const tlsOptions = getTlsOptions(dbSslMode);

console.log('DB Pool Size: ' + dbPoolSize);
console.log('DB Connection Timeout: ' + dbConnectionTimeout);
console.log('DB Idle Timeout: ' + idleTimeoutMillis);
console.log('DB Slow Query Logging Timeout: ' + dbSlowQueryLoggingTimeout);
console.log('DB SSL MODE ENABLE: ' + dbSslMode);

switch (dbType) {
	case DatabaseTypeEnum.mongodb:
		throw 'MongoDB not supported yet';

	case DatabaseTypeEnum.mysql:
		// MikroORM DB Config (MySQL)
		const mikroOrmMySqlOptions: MikroOrmMySqlOptions = {
			driver: MySqlDriver,
			host: process.env.DB_HOST || 'localhost',
			port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
			dbName: process.env.DB_NAME || 'mysql',
			user: process.env.DB_USER || 'root',
			password: process.env.DB_PASS || 'root',
			migrations: {
				path: 'src/modules/not-exists/*.migration{.ts,.js}'
			},
			entities: ['src/modules/not-exists/*.entity{.ts,.js}'],
			driverOptions: {
				connection: {
					ssl: tlsOptions
				}
			},
			pool: {
				min: 10,
				max: dbPoolSize
			},
			namingStrategy: EntityCaseNamingStrategy,
		};
		mikroOrmConnectionConfig = mikroOrmMySqlOptions;

		// TypeORM DB Config (MySQL)
		const typeOrmMySqlOptions: MysqlConnectionOptions = {
			type: dbType,
			ssl: tlsOptions,
			host: process.env.DB_HOST || 'localhost',
			port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
			database: process.env.DB_NAME || 'mysql',
			username: process.env.DB_USER || 'root',
			password: process.env.DB_PASS || 'root',
			// forcing typeorm to use (mysql2) if both (mysql/mysql2) packages found, it prioritize to load (mysql)
			connectorPackage: 'mysql2',
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

		// Knex DB Config (MySQL)
		const knexMySqlOptions: KnexModuleOptions = {
			config: {
				client: 'mysql2', // Database client (MySQL in this case)
				connection: {
					ssl: tlsOptions ? { ca: tlsOptions.ca, rejectUnauthorized: tlsOptions.rejectUnauthorized } : false,
					host: process.env.DB_HOST || 'localhost', // Database host (default: localhost)
					port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306, // Database port (default: 3306)
					database: process.env.DB_NAME || 'mysql', // Database name (default: mysql)
					user: process.env.DB_USER || 'root', // Database username (default: mysql)
					password: process.env.DB_PASS || 'root', // Database password (default: root)
				},
				// Connection pool settings
				pool: {
					min: 10, // Minimum number of connections in the pool
					max: dbPoolSize, // Maximum number of connections in the pool
					// Number of milliseconds a client must sit idle in the pool
					// before it is disconnected from the backend and discarded
					idleTimeoutMillis: idleTimeoutMillis,
					// Connection timeout - number of milliseconds to wait before timing out
					// when connecting a new client
					acquireTimeoutMillis: dbConnectionTimeout
				},
				useNullAsDefault: true, // Specify whether to use null as the default for unspecified fields
			}
		}

		knexConnectionConfig = knexMySqlOptions;

		break;

	case DatabaseTypeEnum.postgres:

		// MikroORM DB Config (PostgreSQL)
		const mikroOrmPostgresOptions: MikroOrmPostgreSqlOptions = {
			driver: PostgreSqlDriver,
			host: process.env.DB_HOST || 'localhost',
			port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
			dbName: process.env.DB_NAME || 'postgres',
			user: process.env.DB_USER || 'postgres',
			password: process.env.DB_PASS || 'root',
			migrations: {
				path: 'src/modules/not-exists/*.migration{.ts,.js}'
			},
			entities: ['src/modules/not-exists/*.entity{.ts,.js}'],
			driverOptions: {
				connection: {
					ssl: tlsOptions
				}
			},
			pool: {
				min: 10,
				max: dbPoolSize,
				// number of milliseconds a client must sit idle in the pool and not be checked out
				// before it is disconnected from the backend and discarded
				idleTimeoutMillis: idleTimeoutMillis,
				// connection timeout - number of milliseconds to wait before timing out when connecting a new client
				acquireTimeoutMillis: dbConnectionTimeout
			},
			namingStrategy: EntityCaseNamingStrategy
		};
		mikroOrmConnectionConfig = mikroOrmPostgresOptions;

		// TypeORM DB Config (PostgreSQL)
		const typeOrmPostgresOptions: PostgresConnectionOptions = {
			type: dbType,
			ssl: tlsOptions,
			host: process.env.DB_HOST || 'localhost',
			port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
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
				minConnection: 10,
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

		// Knex DB Config (PostgreSQL)
		const knexPostgresOptions: KnexModuleOptions = {
			config: {
				client: 'pg', // Database client (PostgreSQL in this case)
				connection: {
					ssl: tlsOptions ? { ca: tlsOptions.ca, rejectUnauthorized: tlsOptions.rejectUnauthorized } : false,
					host: process.env.DB_HOST || 'localhost', // Database host (default: localhost)
					port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432, // Database port (default: 5432)
					database: process.env.DB_NAME || 'postgres', // Database name (default: postgres)
					user: process.env.DB_USER || 'postgres', // Database username (default: postgres)
					password: process.env.DB_PASS || 'root', // Database password (default: root)
				},
				// Connection pool settings
				pool: {
					min: 10, // Minimum number of connections in the pool
					max: dbPoolSize, // Maximum number of connections in the pool
					// Number of milliseconds a client must sit idle in the pool
					// before it is disconnected from the backend and discarded
					idleTimeoutMillis: idleTimeoutMillis,
					// Connection timeout - number of milliseconds to wait before timing out
					// when connecting a new client
					acquireTimeoutMillis: dbConnectionTimeout
				},
				useNullAsDefault: true, // Specify whether to use null as the default for unspecified fields
			}
		}

		knexConnectionConfig = knexPostgresOptions;

		break;

	case DatabaseTypeEnum.sqlite:
		const dbPath = process.env.DB_PATH || path.join(process.cwd(), ...['apps', 'api', 'data'], 'gauzy.sqlite3');
		console.log('Sqlite DB Path: ' + dbPath);

		// MikroORM DB Config (SQLite3)
		const mikroOrmSqliteConfig: MikroOrmSqliteOptions = {
			driver: SqliteDriver,
			dbName: dbPath,
			namingStrategy: EntityCaseNamingStrategy
		};
		mikroOrmConnectionConfig = mikroOrmSqliteConfig;

		// TypeORM DB Config (SQLite3)
		const typeOrmSqliteConfig: DataSourceOptions = {
			type: dbType,
			database: dbPath,
			logging: 'all',
			logger: 'file', //Removes console logging, instead logs all queries in a file ormlogs.log
			synchronize: process.env.DB_SYNCHRONIZE === 'true' // We are using migrations, synchronize should be set to false.
		};
		typeOrmConnectionConfig = typeOrmSqliteConfig;

		// Knex DB Config (SQLite3)
		const knexSqliteConfig: KnexModuleOptions = {
			config: {
				client: 'sqlite3',
				connection: {
					filename: dbPath,
				},
				useNullAsDefault: true, // Specify whether to use null as the default for unspecified fields
			}
		}
		knexConnectionConfig = knexSqliteConfig;

		break;

	case DatabaseTypeEnum.betterSqlite3:
		const betterSqlitePath = process.env.DB_PATH || path.join(process.cwd(), ...['apps', 'api', 'data'], 'gauzy.sqlite3');
		console.log('Better Sqlite DB Path: ' + betterSqlitePath);

		// MikroORM DB Config (Better-SQLite3)
		const mikroOrmBetterSqliteConfig: MikroOrmBetterSqliteOptions = {
			driver: BetterSqliteDriver,
			dbName: betterSqlitePath,
			namingStrategy: EntityCaseNamingStrategy
		};
		mikroOrmConnectionConfig = mikroOrmBetterSqliteConfig;

		// TypeORM DB Config (Better-SQLite3)
		const typeOrmBetterSqliteConfig: DataSourceOptions = {
			type: dbType,
			database: betterSqlitePath,
			logging: 'all',
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
					filename: betterSqlitePath,
				},
				useNullAsDefault: true, // Specify whether to use null as the default for unspecified fields
			}
		}
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
