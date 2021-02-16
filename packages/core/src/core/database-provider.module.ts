import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@gauzy/config';

/**
 * Import and provide base typeorm related classes.
 *
 * @module
 */
@Module({
	imports: [
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			useFactory: (configService: ConfigService) => {
				const { dbConnectionOptions } = configService.config;
				return {
					name: 'default',
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
