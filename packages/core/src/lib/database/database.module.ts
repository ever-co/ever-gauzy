import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { MySqlDriver } from '@mikro-orm/mysql';
import { KnexModule } from 'nest-knexjs';
import { ConfigModule, ConfigService, DatabaseTypeEnum } from '@gauzy/config';
import { ConnectionEntityManager } from './connection-entity-manager';

/**
 * Resolves the MikroORM driver class based on the DB_TYPE environment variable.
 * Defaults to BetterSqliteDriver (matching the default DB_TYPE in database config).
 */
const mikroOrmDriverMap: Record<string, any> = {
	[DatabaseTypeEnum.postgres]: PostgreSqlDriver,
	[DatabaseTypeEnum.mysql]: MySqlDriver,
	[DatabaseTypeEnum.sqlite]: BetterSqliteDriver,
	[DatabaseTypeEnum.betterSqlite3]: BetterSqliteDriver
};

const mikroOrmDriver = mikroOrmDriverMap[process.env.DB_TYPE] || BetterSqliteDriver;

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
