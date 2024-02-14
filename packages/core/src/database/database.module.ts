import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { KnexModule } from 'nest-knexjs';
import { ConfigModule, ConfigService } from '@gauzy/config';

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
			imports: [ConfigModule],
			inject: [ConfigService],
			// Use useFactory, useClass, or useExisting
			useFactory: async (configService: ConfigService) => {
				const { dbMikroOrmConnectionOptions } = configService.config;
				return dbMikroOrmConnectionOptions;
			}
		}),
		/**
		 * Configuration for TypeORM database connection.
		 *
		 * @type {TypeOrmModuleOptions}
		 */
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			// Use useFactory, useClass, or useExisting
			useFactory: async (configService: ConfigService) => {
				const { dbConnectionOptions } = configService.config;
				return dbConnectionOptions;
			}
		}),
		/**
		 * Configure the Knex.js module for the application using asynchronous options.
		 */
		KnexModule.forRootAsync({
			useFactory: () => ({
				config: {
					client: 'pg', // Specify the database client (PostgreSQL in this case)
					useNullAsDefault: true,
					connection: {
						host: process.env.DB_HOST || 'localhost',
						port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
						user: process.env.DB_USER || 'root',
						password: process.env.DB_PASS || 'root',
						database: process.env.DB_NAME || 'postgres',
					}
				},
				retryAttempts: 100, // Number of retry attempts in case of connection failures
				retryDelay: 3000, // Delay between retry attempts in milliseconds
			}),
		})
	],
	exports: [
		TypeOrmModule,
		MikroOrmModule
	]
})
export class DatabaseModule { }
