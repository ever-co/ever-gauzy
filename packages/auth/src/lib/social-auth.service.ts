import { Injectable } from '@nestjs/common';
import { ConfigService, IEnvironment } from '@gauzy/config';
import { hashPassword } from '@gauzy/utils';

export interface OAuthAppConfig {
	clientId: string;
	clientSecret: string;
	redirectUris: string[];
	codeSecret: string;
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

	public getOAuthAppConfig(): OAuthAppConfig {
		const oauthApp = this.configService.get('oauthApp');

		return {
			clientId: oauthApp?.clientId ?? '',
			clientSecret: oauthApp?.clientSecret ?? '',
			redirectUris: oauthApp?.redirectUris ?? [],
			codeSecret: oauthApp?.codeSecret ?? ''
		};
	}

	public isOAuthAppRedirectUriAllowed(redirectUri: string, config?: OAuthAppConfig): boolean {
		const resolved = config ?? this.getOAuthAppConfig();
		return resolved.redirectUris.includes(redirectUri);
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
