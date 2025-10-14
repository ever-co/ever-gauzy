import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@gauzy/config';
import { McpOAuthModule } from './mcp-oauth/mcp-oauth.module';

/**
 * Root Application Module for MCP OAuth Server
 *
 * This is a lightweight OAuth server that only uses TypeORM for database connection.
 */
@Module({
	imports: [
		ConfigModule,
		// TypeORM configuration (minimal - just for User entity)
		TypeOrmModule.forRootAsync({
			useFactory: async (configService: ConfigService) => {
				return configService.getConfigValue('dbConnectionOptions');
			},
			imports: [ConfigModule],
			inject: [ConfigService]
		}),
		McpOAuthModule
	],
	controllers: [],
	providers: []
})
export class AppModule {}
