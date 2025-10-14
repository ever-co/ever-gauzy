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
		const app = await NestFactory.create(AppModule);
		const oauthService = app.get(McpOAuthService);

		// Mount OAuth routes
		app.use('/oauth', oauthService.getOAuthApp());

		// Configure global prefix for other routes if needed
		const globalPrefix = 'api';
		app.setGlobalPrefix(globalPrefix);

		// Get port from environment or use default
		const port = process.env.MCP_AUTH_PORT || 3003;

		// Start server
		await app.listen(port);

		logger.log(`🚀 MCP OAuth Server is running on: http://localhost:${port}`);
		logger.log(`   - Authorization: /oauth/oauth2/authorize`);
		logger.log(`   - Token: /oauth/oauth2/token`);
		logger.log(`   - User Info: /oauth/oauth2/userinfo`);
		logger.log(`   - JWKS: /oauth/oauth2/jwks`);
		logger.log(`   - Introspection: /oauth/oauth2/introspect`);

		// Log server statistics
		const stats = oauthService.getStats();
		logger.log(`📊 Server initialized with ${stats.clients} clients`);
	} catch (error) {
		logger.error('❌ Failed to start MCP OAuth Server:', error);
		process.exit(1);
	}
}

bootstrap();
