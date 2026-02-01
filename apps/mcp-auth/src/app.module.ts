import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@gauzy/config';
import { PasswordHashModule } from '@gauzy/core';
import { McpOAuthModule } from './mcp-oauth/mcp-oauth.module';

/**
 * Root Application Module for MCP OAuth Server
 *
 * This is a lightweight OAuth server that only uses TypeORM for database connection.
 */
@Module({
	imports: [
		ConfigModule,
		// Password hashing module - global, available throughout the app
		PasswordHashModule,
		// TypeORM configuration - use autoLoadEntities to automatically load entities from feature modules
		TypeOrmModule.forRootAsync({
			useFactory: (configService: ConfigService) => ({
				...configService.getConfigValue('dbConnectionOptions'),
				autoLoadEntities: true
			}),
			imports: [ConfigModule],
			inject: [ConfigService]
		}),
		McpOAuthModule
	],
	controllers: [],
	providers: []
})
export class AppModule {}
