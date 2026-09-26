import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { MySqlDriver } from '@mikro-orm/mysql';
import { KnexModule } from 'nest-knexjs';
import { ConfigModule, ConfigService, DatabaseTypeEnum, TypeOrmCompatibleBetterSqliteDriver } from '@gauzy/config';
import { ConnectionEntityManager } from './connection-entity-manager';
import { createPlatformDataSource } from './embedded-transaction-queue';
import { pruneTypeOrmSkeletonMetadata } from './typeorm-skeleton-metadata';

/**
 * Resolves the MikroORM driver class based on the DB_TYPE environment variable.
 * Defaults to the SQLite driver (matching the default DB_TYPE in database config), which is the one the SQLite
 * profile configures: MikroORM's better-sqlite3 driver storing dates as TypeORM does (see @gauzy/config).
 */
const mikroOrmDriverMap: Record<string, any> = {
	[DatabaseTypeEnum.postgres]: PostgreSqlDriver,
	[DatabaseTypeEnum.mysql]: MySqlDriver,
	[DatabaseTypeEnum.sqlite]: TypeOrmCompatibleBetterSqliteDriver,
	[DatabaseTypeEnum.betterSqlite3]: TypeOrmCompatibleBetterSqliteDriver
};

const mikroOrmDriver = mikroOrmDriverMap[process.env.DB_TYPE] || TypeOrmCompatibleBetterSqliteDriver;

/**
 * Import and provide base typeorm related classes.
 *
 * @module
 */
@Global()
@Module({
	imports: [
		/**
		 * Configuration for MikroORM database connection.
		 *
		 * @type {MikroORMModuleOptions}
		 */
		MikroOrmModule.forRootAsync({
			// Explicit driver option required by @mikro-orm/nestjs v6+ when using useFactory + inject.
			// See: https://github.com/mikro-orm/nestjs/pull/204
			driver: mikroOrmDriver,
			// Use useFactory, useClass, or useExisting
			useFactory: async (configService: ConfigService) => {
				const dbMikroOrmConnectionOptions = configService.getConfigValue('dbMikroOrmConnectionOptions');
				return dbMikroOrmConnectionOptions;
			},
			imports: [ConfigModule],
			inject: [ConfigService]
		}),
		/**
		 * Configuration for TypeORM database connection.
		 *
		 * @type {TypeOrmModuleOptions}
		 */
		TypeOrmModule.forRootAsync({
			// Use useFactory, useClass, or useExisting
			useFactory: async (configService: ConfigService) => {
				const dbConnectionOptions = configService.getConfigValue('dbConnectionOptions');
				return dbConnectionOptions;
			},
			// On SQLite every transaction shares the data source's one query runner, so this factory
			// queues them one at a time; any other dialect gets the data source TypeORM builds, untouched.
			// See embedded-transaction-queue.ts.
			//
			// Under DB_ORM=mikro-orm TypeORM is still initialised, over skeleton entities, and the raw
			// TypeORM `@RelationId`, `@Index` and `@Unique` entries naming properties only MikroORM maps
			// would fail its metadata build — so they are removed first. Under TypeORM (production) the
			// call returns before reading anything. See typeorm-skeleton-metadata.ts.
			dataSourceFactory: (options) => {
				pruneTypeOrmSkeletonMetadata();
				return createPlatformDataSource(options);
			},
			imports: [ConfigModule],
			inject: [ConfigService]
		}),
		/**
		 * Configure the Knex.js module for the application using asynchronous options.
		 */
		KnexModule.forRootAsync({
			// Use useFactory, useClass, or useExisting
			useFactory: async (configService: ConfigService) => {
				const dbKnexConnectionOptions = configService.getConfigValue('dbKnexConnectionOptions');
				return dbKnexConnectionOptions;
			},
			imports: [ConfigModule],
			inject: [ConfigService]
		})
	],
	providers: [ConnectionEntityManager],
	exports: [ConnectionEntityManager]
})
export class DatabaseModule {}
