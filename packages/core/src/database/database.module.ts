import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { ConfigModule, ConfigService } from '@gauzy/config';
import { API_DB_CONNECTION, SEEDER_DB_CONNECTION } from '@gauzy/common';
import { initializedDataSource } from './database-helper';

/**
 * Import and provide base typeorm related classes.
 *
 * @module
 */
@Module({
	imports: [],
	providers: [],
	exports: []
})
export class DatabaseModule {
	/**
	 * Database Connection Module For API Connection
	 *
	 * @returns
	 */
	static forRoot(): DynamicModule {
		return {
			module: DatabaseModule,
			imports: [
				TypeOrmModule.forRootAsync({
					imports: [ConfigModule],
					inject: [ConfigService],
					// Use useFactory, useClass, or useExisting
					  // to configure the DataSourceOptions.
					useFactory: async (configService: ConfigService) => {
						const { dbConnectionOptions } = configService.config;
						return dbConnectionOptions;
					},
					// dataSource receives the configured DataSourceOptions
					  // and returns a Promise<DataSource>.
					dataSourceFactory: async (options: DataSourceOptions) => {
						return initializedDataSource({
							name: API_DB_CONNECTION,
							...options
						});
					}
				} as TypeOrmModuleAsyncOptions)
			],
			providers: [],
			exports: []
		} as DynamicModule;
	}

	/**
	 * Database Connection Module For SEEDER Connection
	 *
	 * @returns
	 */
	static forSeeder(): DynamicModule {
		return {
			module: DatabaseModule,
			imports: [
				TypeOrmModule.forRootAsync({
					imports: [ConfigModule],
					inject: [ConfigService],
					// Use useFactory, useClass, or useExisting
					  // to configure the DataSourceOptions.
					useFactory: async (configService: ConfigService) => {
						const { dbConnectionOptions } = configService.config;
						return dbConnectionOptions;
					},
					// dataSource receives the configured DataSourceOptions
					  // and returns a Promise<DataSource>.
					dataSourceFactory: async (options: DataSourceOptions) => {
						return initializedDataSource({
							name: SEEDER_DB_CONNECTION,
							...options
						});
					}
				} as TypeOrmModuleAsyncOptions)
			],
			providers: [],
			exports: []
		} as DynamicModule;
	}
}
