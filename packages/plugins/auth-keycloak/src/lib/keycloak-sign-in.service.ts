import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
	OidcClientService,
	OidcCookieRequest,
	OidcCookieResponse,
	OidcIssuerConfig,
	OidcTransactionCookieOptions,
	OidcTransactionService,
	isOidcError
} from '@gauzy/auth';
import { environment } from '@gauzy/config';

/** Cookie that carries the Keycloak sign-in transaction between the start and the callback. */
export const KEYCLOAK_TRANSACTION_COOKIE = 'gauzy_keycloak_txn';

/** Scopes requested from Keycloak: the e-mail and its verification state come from the ID token. */
export const KEYCLOAK_SCOPES = ['openid', 'email', 'profile'];

/** The value `registerAs('keycloak')` falls back to when `KEYCLOAK_AUTH_SERVER_URL` is unset. */
const SAMPLE_AUTH_SERVER_URL = 'https://keycloak.example.com/auth';

/** Drops trailing slashes without a regular expression. */
function stripTrailingSlashes(value: string): string {
	let end = value.length;
	while (end > 0 && value.charAt(end - 1) === '/') {
		end--;
	}
	return value.slice(0, end);
}

/** The answer of `GET /api/auth/keycloak/config`. */
export interface KeycloakPublicConfig {
	enabled: boolean;
	reason?: 'unconfigured';
}

/** The verified e-mail of a completed Keycloak sign-in, or why there is none. */
export type KeycloakSignInResult =
	| { status: 'verified'; email: string }
	| { status: 'email_unverified' }
	| { status: 'failed' };

/**
 * Keycloak sign-in on the shared OIDC library.
 *
 * The authorization code flow runs with PKCE, `state` and `nonce` kept in a signed cookie, and the
 * ID token is verified locally against the realm's published keys. Only a verified e-mail address is
 * handed on to Gauzy's existing social sign-in, which signs the person in to the account that owns
 * that address; nothing is created for an unknown address.
 */
@Injectable()
export class KeycloakSignInService {
	private readonly logger = new Logger(KeycloakSignInService.name);
	private readonly issuerConfig: OidcIssuerConfig | null;

	constructor(
		private readonly configService: ConfigService,
		private readonly transactions: OidcTransactionService,
		private readonly client: OidcClientService
	) {
		this.issuerConfig = this.resolveIssuerConfig();
		if (!this.issuerConfig) {
			this.logger.warn('Keycloak sign-in is enabled but KEYCLOAK_AUTH_SERVER_URL or KEYCLOAK_REALM is missing.');
		}
	}

	/** What the login page needs to know. */
	publicConfig(): KeycloakPublicConfig {
		return this.issuerConfig ? { enabled: true } : { enabled: false, reason: 'unconfigured' };
	}

	/**
	 * Starts a sign-in: writes the transaction cookie and returns the Keycloak authorize URL (or the
	 * login page with an error code when the realm cannot be reached).
	 *
	 * @param response - The response that will redirect.
	 * @returns The URL to redirect to.
	 */
	async start(response: OidcCookieResponse): Promise<string> {
		const config = this.requireConfig();
		try {
			const transaction = await this.transactions.begin(response, this.cookie(), {
				issuer: config.issuer,
				mode: 'signin'
			});
			return await this.client.buildAuthorizeUrl(config, transaction);
		} catch (error) {
			this.logger.warn(`Keycloak sign-in could not start: ${isOidcError(error) ? error.code : 'unexpected error'}`);
			return this.loginPageUrl('sign_in_failed');
		}
	}

	/**
	 * Completes a sign-in callback.
	 *
	 * @param request - The callback request.
	 * @param response - The callback response.
	 * @param query - The `code`, `state` and `error` query parameters.
	 * @returns The verified e-mail, or why there is none.
	 */
	async complete(
		request: OidcCookieRequest,
		response: OidcCookieResponse,
		query: { code?: string; state?: string; error?: string }
	): Promise<KeycloakSignInResult> {
		const config = this.requireConfig();
		try {
			const transaction = await this.transactions.complete(request, response, this.cookie(), query.state);
			if (query.error || !query.code) {
				return { status: 'failed' };
			}
			const { idToken } = await this.client.exchangeCode(config, query.code, transaction);
			if (!idToken.emailVerified || !idToken.email) {
				return { status: 'email_unverified' };
			}
			return { status: 'verified', email: idToken.email };
		} catch (error) {
			this.logger.warn(`Keycloak sign-in failed: ${isOidcError(error) ? error.code : 'unexpected error'}`);
			return { status: 'failed' };
		}
	}

	/** Where the browser goes when a sign-in cannot complete. */
	loginPageUrl(reason: string): string {
		return `${stripTrailingSlashes(environment.clientBaseUrl)}/#/auth/login?error=${encodeURIComponent(reason)}`;
	}

	private requireConfig(): OidcIssuerConfig {
		if (!this.issuerConfig) {
			throw new NotFoundException();
		}
		return this.issuerConfig;
	}

	private cookie(): OidcTransactionCookieOptions {
		return {
			name: KEYCLOAK_TRANSACTION_COOKIE,
			secure: String(environment.baseUrl).startsWith('https://')
		};
	}

	private resolveIssuerConfig(): OidcIssuerConfig | null {
		const clientId = this.configService.get<string>('keycloak.clientId')?.trim();
		const clientSecret = this.configService.get<string>('keycloak.clientSecret')?.trim();
		const realm = this.configService.get<string>('keycloak.realm')?.trim();
		const authServerURL = this.configService.get<string>('keycloak.authServerURL')?.trim();
		const callbackURL = this.configService.get<string>('keycloak.callbackURL')?.trim();

		if (!clientId || !clientSecret || !realm || !authServerURL || authServerURL === SAMPLE_AUTH_SERVER_URL) {
			return null;
		}
		return {
			issuer: `${stripTrailingSlashes(authServerURL)}/realms/${encodeURIComponent(realm)}`,
			clientId,
			clientSecret,
			redirectUri: callbackURL || `${stripTrailingSlashes(environment.baseUrl)}/api/auth/keycloak/callback`,
			scopes: KEYCLOAK_SCOPES
		};
	}
}
