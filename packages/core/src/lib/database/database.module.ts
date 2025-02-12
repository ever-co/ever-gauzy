import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { KnexModule } from 'nest-knexjs';
import { ConfigModule, ConfigService } from '@gauzy/config';
import { ConnectionEntityManager } from './connection-entity-manager';

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
