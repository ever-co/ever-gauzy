/**
 * MCP OAuth Authorization Server
 *
 * This server provides OAuth 2.0 authorization for MCP (Model Context Protocol)
 * clients to access Gauzy API resources.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { McpOAuthService } from './mcp-oauth/mcp-oauth.service';

async function bootstrap() {
	const logger = new Logger('Bootstrap');

	try {
		// Create NestJS app with raw body for OAuth endpoints
		const app = await NestFactory.create(AppModule, {
			bodyParser: false // Disable NestJS body parser to let Express handle it
		});

		const oauthService = app.get(McpOAuthService);

		// Enable CORS before mounting OAuth routes
		app.enableCors({
			origin: '*',
			credentials: true,
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
			allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
		});

		// Mount OAuth Express app BEFORE NestJS middleware
		// This ensures OAuth routes are handled by the OAuth server's Express app
		const expressApp = app.getHttpAdapter().getInstance();
		expressApp.use('/', oauthService.getOAuthApp());

		// Get port from environment or use default
		const port = process.env.MCP_AUTH_PORT || 3003;

		// Start server
		await app.listen(port);

		logger.log(`🚀 MCP OAuth Server is running on: http://localhost:${port}`);
		logger.log(`📡 OAuth 2.0 Endpoints:`);
		logger.log(`   - Authorization: POST http://localhost:${port}/oauth2/authorize`);
		logger.log(`   - Token: POST http://localhost:${port}/oauth2/token`);
		logger.log(`   - User Info: GET http://localhost:${port}/oauth2/userinfo`);
		logger.log(`   - JWKS: GET http://localhost:${port}/.well-known/jwks.json`);
		logger.log(`   - Registration: POST http://localhost:${port}/oauth2/register`);
		logger.log(`   - Introspection: POST http://localhost:${port}/oauth2/introspect`);
		logger.log(`   - Metadata: GET http://localhost:${port}/.well-known/oauth-authorization-server`);

		// Log server statistics
		const stats = oauthService.getStats();
		logger.log(`📊 Server initialized with ${stats.clients} clients`);
	} catch (error) {
		logger.error('❌ Failed to start MCP OAuth Server:', error);
		process.exit(1);
	}
}

bootstrap();
