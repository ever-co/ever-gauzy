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

console.log(chalk.magenta(`NodeJs version %s`), process.version);
console.log('Is DEMO: ', process.env.DEMO);
console.log('NODE_ENV: ', process.env.NODE_ENV);

const dbORM: MultiORM = getORMType();
console.log('DB ORM: ' + dbORM);

const dbType = process.env.DB_TYPE || DatabaseTypeEnum.betterSqlite3;

console.log(`Selected DB Type (DB_TYPE env var): ${dbType}`);
console.log('DB Synchronize: ' + process.env.DB_SYNCHRONIZE);

let typeOrmConnectionConfig: TypeOrmModuleOptions;
let mikroOrmConnectionConfig: MikroOrmModuleOptions;

// We set default pool size as 80. Usually PG has 100 connections max by default.
const dbPoolSize = process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE) : 80;
const dbConnectionTimeout = process.env.DB_CONNECTION_TIMEOUT ? parseInt(process.env.DB_CONNECTION_TIMEOUT) : 5000; // 5 seconds default
const idleTimeoutMillis = process.env.DB_IDLE_TIMEOUT ? parseInt(process.env.DB_IDLE_TIMEOUT) : 10000; // 10 seconds
const dbSlowQueryLoggingTimeout = process.env.DB_SLOW_QUERY_LOGGING_TIMEOUT ? parseInt(process.env.DB_SLOW_QUERY_LOGGING_TIMEOUT) : 10000; // 10 seconds default

console.log('DB Pool Size: ' + dbPoolSize);
console.log('DB Connection Timeout: ' + dbConnectionTimeout);
console.log('DB Idle Timeout: ' + idleTimeoutMillis);
console.log('DB Slow Query Logging Timeout: ' + dbSlowQueryLoggingTimeout);

switch (dbType) {
	case DatabaseTypeEnum.mongodb:
		throw 'MongoDB not supported yet';

	case DatabaseTypeEnum.mysql:
		// MikroORM DB Config
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
				connection: { ssl: getTlsOptions(process.env.DB_SSL_MODE) }
			},
			pool: {
				min: 10,
				max: dbPoolSize
			},
			namingStrategy: EntityCaseNamingStrategy
		};
		mikroOrmConnectionConfig = mikroOrmMySqlOptions;

		// TypeORM Config
		const typeOrmMySqlOptions: MysqlConnectionOptions = {
			type: dbType,
			ssl: getTlsOptions(process.env.DB_SSL_MODE),
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

		break;

	case DatabaseTypeEnum.postgres:
		// MikroORM DB Config
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
				connection: { ssl: getTlsOptions(process.env.DB_SSL_MODE) }
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

		// TypeORM DB Config
		const typeOrmPostgresOptions: PostgresConnectionOptions = {
			type: dbType,
			ssl: getTlsOptions(process.env.DB_SSL_MODE),
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

		break;

	case DatabaseTypeEnum.sqlite:
		const dbPath = process.env.DB_PATH || path.join(process.cwd(), ...['apps', 'api', 'data'], 'gauzy.sqlite3');
		console.log('Sqlite DB Path: ' + dbPath);

		// MikroORM DB Config
		const mikroORMSqliteConfig: MikroOrmSqliteOptions = {
			driver: SqliteDriver,
			dbName: dbPath,
			namingStrategy: EntityCaseNamingStrategy
		};
		mikroOrmConnectionConfig = mikroORMSqliteConfig;

		// TypeORM DB Config
		const sqliteConfig: DataSourceOptions = {
			type: dbType,
			database: dbPath,
			logging: 'all',
			logger: 'file', //Removes console logging, instead logs all queries in a file ormlogs.log
			synchronize: process.env.DB_SYNCHRONIZE === 'true' // We are using migrations, synchronize should be set to false.
		};
		typeOrmConnectionConfig = sqliteConfig;

		break;

	case DatabaseTypeEnum.betterSqlite3:
		const betterSqlitePath = process.env.DB_PATH || path.join(process.cwd(), ...['apps', 'api', 'data'], 'gauzy.sqlite3');
		console.log('Better Sqlite DB Path: ' + betterSqlitePath);

		// MikroORM DB Config
		const mikroORMBetterSqliteConfig: MikroOrmBetterSqliteOptions = {
			driver: BetterSqliteDriver,
			dbName: betterSqlitePath,
			namingStrategy: EntityCaseNamingStrategy
		};
		mikroOrmConnectionConfig = mikroORMBetterSqliteConfig;

		// TypeORM DB Config
		const betterSqliteConfig: DataSourceOptions = {
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
		typeOrmConnectionConfig = betterSqliteConfig;

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
