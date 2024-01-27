import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigModule, ConfigService } from '@gauzy/config';

/**
 * Import and provide base typeorm related classes.
 *
 * @module
 */
@Global()
@Module({
	imports: [
		MikroOrmModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			// Use useFactory, useClass, or useExisting
			useFactory: async (configService: ConfigService) => {
				const { dbMikroOrmConnectionOptions } = configService.config;
				return dbMikroOrmConnectionOptions;
			}
		}),
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			// Use useFactory, useClass, or useExisting
			useFactory: async (configService: ConfigService) => {
				const { dbConnectionOptions } = configService.config;
				return dbConnectionOptions;
			}
		})
	],
	exports: [
		TypeOrmModule,
		MikroOrmModule
	]
})
export class DatabaseModule { }
