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
			useFactory: (configService: ConfigService) => {
				const { dbConnectionOptions } = configService.config;
				return {
					name: DEFAULT_DB_CONNECTION,
					...dbConnectionOptions
				};
			},
			inject: [ConfigService]
		} as TypeOrmModuleAsyncOptions)
	],
	providers: [],
	exports: []
})
export class DatabaseProviderModule {}
