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
					client: 'pg', // Database client (PostgreSQL in this case)
					useNullAsDefault: true, // Specify whether to use null as the default for unspecified fields
					connection: {
						host: process.env.DB_HOST || 'localhost', // Database host (default: localhost)
						port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432, // Database port (default: 5432)
						database: process.env.DB_NAME || 'postgres', // Database name (default: postgres)
						user: process.env.DB_USER || 'postgres', // Database username (default: postgres)
						password: process.env.DB_PASS || 'root', // Database password (default: root)
					},
					// Connection pool settings
					pool: {
						min: 10, // Minimum number of connections in the pool
						max: process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE) : 80, // Maximum number of connections in the pool
						// Number of milliseconds a client must sit idle in the pool
						// before it is disconnected from the backend and discarded
						idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT ? parseInt(process.env.DB_IDLE_TIMEOUT) : 10000, // 10 seconds
						// Connection timeout - number of milliseconds to wait before timing out
						// when connecting a new client
						acquireTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT ? parseInt(process.env.DB_CONNECTION_TIMEOUT) : 5000, // 5 seconds default
					},
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
