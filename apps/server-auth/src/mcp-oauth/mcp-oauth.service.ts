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
		// Initialize OAuth server with configuration
		const port = process.env.MCP_AUTH_PORT || 3003;
		const baseUrl = process.env.MCP_AUTH_JWT_ISSUER || `http://localhost:${port}`;

		this.oauthServer = new OAuth2AuthorizationServer({
			issuer: process.env.MCP_AUTH_JWT_ISSUER || baseUrl,
			baseUrl: baseUrl,
			audience: process.env.MCP_AUTH_JWT_AUDIENCE || 'gauzy-mcp-api',
			enableClientRegistration: true,
			authorizationEndpoint: '/oauth2/authorize',
			tokenEndpoint: '/oauth2/token',
			jwksEndpoint: '/.well-known/jwks.json',
			loginEndpoint: '/oauth2/login',
			registrationEndpoint: '/oauth2/register',
			introspectionEndpoint: '/oauth2/introspect',
			userInfoEndpoint: '/oauth2/userinfo',
			sessionSecret: process.env.MCP_AUTH_SESSION_SECRET || 'your-secret-key-change-in-production',
			redisUrl: process.env.REDIS_URL // Optional
		});
	}

	onModuleInit() {
		// Wire UserService methods with OAuth server
		this.setupAuthentication();
	}

	/**
	 * Setup authentication by wiring UserService with OAuth server
	 */
	private setupAuthentication() {
		// Set user authenticator
		this.oauthServer.setUserAuthenticator(async (credentials) => {
			const { email, password } = credentials;

			// Use UserService to authenticate
			const user = await this.userService.authenticateMcpUser(email, password);

			if (!user) {
				return null;
			}

			const organizationId =
				user.organizations?.[0]?.organization?.id || user['defaultOrganizationId'];

			// Transform to OAuth format
			return {
				userId: user.id,
				email: user.email,
				name:
					user.firstName && user.lastName
						? `${user.firstName} ${user.lastName}`
						: user.email,
				organizationId,
				tenantId: user.tenantId,
				roles: user.role ? [user.role.name] : [],
				emailVerified: !!user['emailVerifiedAt'],
				picture: user['imageUrl']
			};
		});

		// Set user info provider
		this.oauthServer.setUserInfoProvider(async (userId) => {
			// Use UserService to get user info
			const user = await this.userService.getMcpUserInfo(userId);

			if (!user) {
				return null;
			}

			const organizationId =
				user.organizations?.[0]?.organization?.id || user['defaultOrganizationId'];

			// Transform to OAuth format
			return {
				userId: user.id,
				email: user.email,
				name:
					user.firstName && user.lastName
						? `${user.firstName} ${user.lastName}`
						: user.email,
				organizationId,
				tenantId: user.tenantId,
				roles: user.role ? [user.role.name] : [],
				emailVerified: !!user['emailVerifiedAt'],
				picture: user['imageUrl']
			};
		});
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
