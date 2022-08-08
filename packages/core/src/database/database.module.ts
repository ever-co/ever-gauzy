import { Global, Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@gauzy/config';

/**
 * Import and provide base typeorm related classes.
 *
 * @module
 */
@Global()
@Module({
	imports: [
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			// Use useFactory, useClass, or useExisting
			// to configure the DataSourceOptions.
			useFactory: async (configService: ConfigService) => {
				const { dbConnectionOptions } = configService.config;
				return dbConnectionOptions;
			}
		} as TypeOrmModuleAsyncOptions)
	],
	providers: [],
	exports: [
		TypeOrmModule
	]
})
export class DatabaseModule {}
