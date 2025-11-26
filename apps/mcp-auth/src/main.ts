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

		// Get Express instance to configure trust proxy
		const expressApp = app.getHttpAdapter().getInstance();

		// Configure trust proxy for production environments behind reverse proxies
		// This allows Express to correctly identify client IPs from X-Forwarded-For headers
		const baseUrl = process.env.MCP_AUTH_BASE_URL || process.env.MCP_AUTH_JWT_ISSUER || `http://localhost:${process.env.MCP_AUTH_PORT || 3003}`;
		const isHttps = baseUrl.startsWith('https');
		const trustedProxies = process.env.MCP_TRUSTED_PROXIES?.split(',').map(p => p.trim()).filter(p => p.length > 0);

		if (trustedProxies && trustedProxies.length > 0) {
			expressApp.set('trust proxy', trustedProxies);
			logger.log(`Trust proxy enabled for NestJS app: ${trustedProxies.join(', ')}`);
		} else if (isHttps || process.env.NODE_ENV === 'production') {
			// For HTTPS or production (like ngrok, Cloudflare, AWS ALB), trust the first proxy
			// This is safe and recommended for single-proxy scenarios
			expressApp.set('trust proxy', 1);
			logger.log('Trust proxy enabled for first proxy (HTTPS/production mode)');
		} else {
			logger.warn('⚠️  Trust proxy not configured. X-Forwarded-* headers will be ignored. Set MCP_TRUSTED_PROXIES to enable.');
		}

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
