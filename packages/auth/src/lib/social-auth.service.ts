import { Injectable } from '@nestjs/common';
import { ConfigService, IEnvironment } from '@gauzy/config';
import { hashPassword } from '@gauzy/utils';

/**
 * Resolved view of a single OAuth client used by the auth pipeline.
 *
 * Loaded from the `oauth_clients` registry by
 * `AuthService.resolveOAuthClient`. The plaintext `clientSecret` is NEVER
 * present here — `/token` validates the presented secret against the
 * stored `clientSecretHash` via `OAuthClientService.validateClientSecret`
 * (constant-time scrypt compare).
 */
export interface OAuthAppConfig {
	clientId: string;
	clientSecretHash: string | null;
	redirectUris: string[];
	codeSecret: string;
	name: string;
	description?: string | null;
	allowedScopes: string[];
	allowedGrantTypes: string[];
	pkceRequired: boolean;
	accessTokenTtl: number;
	/** Owning tenant. `null` => global client usable by any tenant. */
	tenantId?: string | null;
	clientType?: string;
}

export interface OAuthAppPendingRequest {
	requestId: string;
	clientId: string;
	redirectUri: string;
	scope?: string;
	state?: string;
	createdAt: number;
}

export interface OAuthAppAuthorizationRequest {
	userId: string;
	tenantId: string;
	clientId: string;
	redirectUri: string;
	scope?: string;
	state?: string;
}

export interface OAuthAppTokenRequest {
	code: string;
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}

export interface OAuthAppTokenResponse {
	accessToken: string;
	expiresIn: number;
	tokenType: string;
	scope: string;
}

/**
 * Base class for social authentication.
 */
export abstract class BaseSocialAuth {
	/**
	 * Validate OAuth login email.
	 *
	 * @param args - Arguments for validating OAuth login email.
	 * @returns The result of the validation.
	 */
	public abstract validateOAuthLoginEmail(args: []): any;
}

@Injectable()
export class SocialAuthService extends BaseSocialAuth {
	protected readonly configService: ConfigService;
	protected readonly clientBaseUrl: string;

	constructor() {
		super();
		this.configService = new ConfigService();
		this.clientBaseUrl = this.configService.get('clientBaseUrl') as Extract<keyof IEnvironment, string>;
	}

	public validateOAuthLoginEmail(args: []): any {}

	/**
	 * Get the client base URL for frontend redirects.
	 */
	public getClientBaseUrl(): string {
		return this.clientBaseUrl;
	}

	/**
	 * Resolve a single OAuth client by its public `clientId`. The concrete
	 * subclass (`AuthService`) loads from the `oauth_clients` registry.
	 * Throws if the client does not exist or is inactive — callers map
	 * that to `400 invalid_client`.
	 */
	public async resolveOAuthClient(_clientId: string): Promise<OAuthAppConfig> {
		throw new Error('resolveOAuthClient is not implemented');
	}

	/**
	 * Whether the supplied redirect URI is allow-listed for the given
	 * resolved OAuth client config. Exact-match, no wildcards.
	 */
	public isOAuthAppRedirectUriAllowed(redirectUri: string, config: OAuthAppConfig): boolean {
		return Array.isArray(config?.redirectUris) && config.redirectUris.includes(redirectUri);
	}

	/**
	 * Store a pending OAuth authorization request in cache.
	 */
	public async storeOAuthAppPendingRequest(_request: OAuthAppPendingRequest): Promise<void> {
		throw new Error('OAuth app pending request storage is not implemented');
	}

	/**
	 * Retrieve a pending OAuth authorization request from cache.
	 */
	public async getOAuthAppPendingRequest(_requestId: string): Promise<OAuthAppPendingRequest | null> {
		throw new Error('OAuth app pending request retrieval is not implemented');
	}

	/**
	 * Delete a pending OAuth authorization request from cache.
	 */
	public async deleteOAuthAppPendingRequest(_requestId: string): Promise<void> {
		throw new Error('OAuth app pending request deletion is not implemented');
	}

	public async createOAuthAppAuthorizationCode(
		_request: OAuthAppAuthorizationRequest
	): Promise<string> {
		throw new Error('OAuth app authorization is not implemented');
	}

	public async exchangeOAuthAppAuthorizationCode(
		_request: OAuthAppTokenRequest
	): Promise<OAuthAppTokenResponse> {
		throw new Error('OAuth app token exchange is not implemented');
	}

	/**
	 * Generate a hash for the provided password using scrypt.
	 *
	 * @param password - The password to hash.
	 * @returns A promise that resolves to the hashed password.
	 */
	public async getPasswordHash(password: string): Promise<string> {
		try {
			return await hashPassword(password);
		} catch (error) {
			console.error('Error in getPasswordHash:', error);
			throw error;
		}
	}

	/**
	 * Redirect the user based on the success status.
	 *
	 * @param success - Indicates whether the operation was successful.
	 * @param auth - Object containing JWT and userId.
	 * @param res - Express response object.
	 * @returns The redirect response.
	 */
	async routeRedirect(success: boolean, auth: { jwt: string; userId: string }, res: any) {
		const { userId, jwt } = auth;

		const redirectPath = success ? `#/sign-in/success?jwt=${jwt}&userId=${userId}` : `#/auth/register`;
		const redirectUrl = `${this.clientBaseUrl}/${redirectPath}`;

		return res.redirect(redirectUrl);
	}
}
