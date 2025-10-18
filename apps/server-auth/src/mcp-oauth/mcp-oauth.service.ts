import { Injectable, OnModuleInit } from '@nestjs/common';
import { OAuth2AuthorizationServer } from '@gauzy/auth';
import { OAuthUserService } from '../user/oauth-user.service';

/**
 * MCP OAuth Service
 *
 * This service wires the generic OAuth2AuthorizationServer from @gauzy/auth
 */
@Injectable()
export class McpOAuthService implements OnModuleInit {
	private oauthServer: OAuth2AuthorizationServer;

	constructor(private readonly userService: OAuthUserService) {
		// Validate required environment variable
		if (!process.env.MCP_AUTH_SESSION_SECRET || process.env.MCP_AUTH_SESSION_SECRET.trim() === '') {
			throw new Error(
				'Please set a secure session secret in your environment configuration.'
			);
		}

		// Initialize OAuth server with configuration
		const port = process.env.MCP_AUTH_PORT || 3003;
		const baseUrl = process.env.MCP_AUTH_JWT_ISSUER || `http://localhost:${port}`;

		this.oauthServer = new OAuth2AuthorizationServer({
			issuer: process.env.MCP_AUTH_JWT_ISSUER || baseUrl,
			baseUrl: baseUrl,
			audience: process.env.MCP_AUTH_JWT_AUDIENCE || 'gauzy-mcp-api',
			enableClientRegistration: false,
			authorizationEndpoint: '/oauth2/authorize',
			tokenEndpoint: '/oauth2/token',
			jwksEndpoint: '/.well-known/jwks.json',
			loginEndpoint: '/oauth2/login',
			registrationEndpoint: '/oauth2/register',
			introspectionEndpoint: '/oauth2/introspect',
			userInfoEndpoint: '/oauth2/userinfo',
			sessionSecret: process.env.MCP_AUTH_SESSION_SECRET,
			redisUrl: process.env.REDIS_URL, // Optional
			// Wire providers up-front to satisfy constructor validation
			userAuthenticator: async ({ email, password }) => {
					const user = await this.userService.authenticateMcpUser(email, password);
					if (!user) return null;
					const organizationId = user.organizations?.[0]?.organization?.id || (user as any)['defaultOrganizationId'];
					return {
						userId: user.id!,
						email: user.email!,
						name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email!,
						organizationId,
						tenantId: user.tenantId!,
						roles: user.role ? [user.role.name] : [],
						emailVerified: !!(user as any)['emailVerifiedAt'],
						picture: (user as any)['imageUrl']
					};
				},
				userInfoProvider: async (userId: string) => {
					const user = await this.userService.getMcpUserInfo(userId);
					if (!user) return null;
					const organizationId = user.organizations?.[0]?.organization?.id || (user as any)['defaultOrganizationId'];
					return {
						userId: user.id!,
						email: user.email!,
						name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email!,
						organizationId,
						tenantId: user.tenantId!,
						roles: user.role ? [user.role.name] : [],
						emailVerified: !!(user as any)['emailVerifiedAt'],
						picture: (user as any)['imageUrl']
					};
				}
		});
	}

	onModuleInit() {
		// No-op; providers wired in constructor
	}

	/**
	 * Get the Express app with OAuth routes
	 */
	getOAuthApp() {
		return this.oauthServer.getApp();
	}

	/**
	 * Get server statistics
	 */
	getStats() {
		return this.oauthServer.getStats();
	}
}
