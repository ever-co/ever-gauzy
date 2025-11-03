import { Injectable, OnModuleInit } from '@nestjs/common';
import { OAuth2AuthorizationServer, UserInfo } from '@gauzy/auth';
import { OAuthUserService } from '../user/oauth-user.service';
import { IUser } from '@gauzy/contracts';

/**
 * Extended user interface with additional fields that may be present
 * on the user object but are not part of the base IUser interface
 */
interface ExtendedMcpUser extends Omit<IUser, 'emailVerifiedAt'> {
	defaultOrganizationId?: string;
	emailVerifiedAt?: Date | string | null;
	imageUrl?: string | null;
}

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
				'MCP_AUTH_SESSION_SECRET environment variable is required but not set. Please configure a secure session secret.'
			);
		}

		// Initialize OAuth server with configuration
		const port = process.env.MCP_AUTH_PORT || 3003;
		const baseUrl = process.env.MCP_AUTH_JWT_ISSUER || `http://localhost:${port}`;

		// Build Redis URL from REDIS_URL or individual parameters
		const redisUrl = (() => {
			if (process.env.REDIS_ENABLED !== 'true') {
				return undefined;
			}

			const { REDIS_URL, REDIS_HOST, REDIS_PORT, REDIS_USER, REDIS_PASSWORD, REDIS_TLS } = process.env;

			// If REDIS_URL is provided, use it directly
			if (REDIS_URL) {
				return REDIS_URL;
			}

			// If individual parameters are provided, construct the URL
			if (REDIS_HOST && REDIS_PORT) {
				const redisProtocol = REDIS_TLS === 'true' ? 'rediss' : 'redis';
				const auth = REDIS_USER && REDIS_PASSWORD ? `${REDIS_USER}:${REDIS_PASSWORD}@` : '';
				return `${redisProtocol}://${auth}${REDIS_HOST}:${REDIS_PORT}`;
			}

			// If neither REDIS_URL nor required individual parameters are provided, log warning
			console.warn(
				'Redis is enabled but neither REDIS_URL nor REDIS_HOST/REDIS_PORT are configured. Redis will not be used.'
			);
			return undefined;
		})();

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
			sessionSecret: process.env.MCP_AUTH_SESSION_SECRET,
			redisUrl: redisUrl,
			// Wire providers up-front to satisfy constructor validation
			userAuthenticator: async ({ email, password }) => {
				const user = await this.userService.authenticateMcpUser(email, password);
				if (!user) return null;

				return this.mapMcpUserToAuthPayload(user);
			},
			userInfoProvider: async (userId: string) => {
				const user = await this.userService.getMcpUserInfo(userId);
				if (!user) return null;

				return this.mapMcpUserToAuthPayload(user);
			}
		});
	}

	/**
	 * Maps an MCP user to the auth payload object
	 * Extracts and transforms user data for OAuth authentication
	 *
	 * @param user - The user object from the database
	 * @returns Auth payload object with user information, or null if required fields are missing
	 */
	private mapMcpUserToAuthPayload(user: IUser): UserInfo | null {
		// Validate required fields
		if (!user.id || !user.email || !user.tenantId) {
			return null;
		}

		// Cast to extended user type for accessing optional fields
		const extendedUser = user as ExtendedMcpUser;

		const organizationId = user.organizations?.[0]?.organization?.id || extendedUser.defaultOrganizationId;

		return {
			userId: user.id,
			email: user.email,
			name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
			organizationId,
			tenantId: user.tenantId,
			roles: user.role ? [user.role.name] : [],
			emailVerified: user.isEmailVerified ?? !!extendedUser.emailVerifiedAt,
			picture: extendedUser.imageUrl
		};
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
