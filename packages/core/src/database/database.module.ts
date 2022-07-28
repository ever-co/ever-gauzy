import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@gauzy/config';
import { DEFAULT_DB_CONNECTION } from '@gauzy/common';

/**
 * Import and provide base typeorm related classes.
 *
 * @module
 */
@Module({
	imports: [
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			name: DEFAULT_DB_CONNECTION,
			useFactory: async (configService: ConfigService) => {
				const { dbConnectionOptions } = configService.config;
				return dbConnectionOptions;
			},
			inject: [ConfigService]
		} as TypeOrmModuleAsyncOptions)
	],
	providers: [],
	exports: [TypeOrmModule]
})
export class DatabaseModule {}
