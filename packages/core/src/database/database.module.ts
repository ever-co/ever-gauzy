import { Global, Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { MikroOrmModule, MikroOrmModuleAsyncOptions } from '@mikro-orm/nestjs';
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
		} as TypeOrmModuleAsyncOptions),
		MikroOrmModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			// Use useFactory, useClass, or useExisting
			// to configure the DataSourceOptions.
			useFactory: async (configService: ConfigService) => {
				const { dbMikroOrmConnectionOptions } = configService.config;
				console.log(dbMikroOrmConnectionOptions);
				return dbMikroOrmConnectionOptions;
			}
		} as MikroOrmModuleAsyncOptions)
	],
	providers: [],
	exports: [TypeOrmModule]
})
export class DatabaseModule { }
