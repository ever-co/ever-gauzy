import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
	OidcCallbackQuery,
	OidcCookieRequest,
	OidcCookieResponse,
	OidcEmailSignInFlow,
	OidcEmailSignInResult,
	OidcEmailSignInService
} from '@gauzy/auth';
import { environment } from '@gauzy/config';
import { isMissingOrPlaceholder, isMissingOrSampleAuthServerUrl } from './auth-keycloak.config';

/** Cookie that carries the Keycloak sign-in transaction between the start and the callback. */
export const KEYCLOAK_TRANSACTION_COOKIE = 'gauzy_keycloak_txn';

/** Scopes requested from Keycloak: the e-mail and its verification state come from the ID token. */
export const KEYCLOAK_SCOPES = ['openid', 'email', 'profile'];

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
export type KeycloakSignInResult = OidcEmailSignInResult;

/**
 * Keycloak sign-in on the shared OIDC library.
 *
 * The authorization code flow runs with PKCE, `state` and `nonce` kept in a signed cookie, and the
 * ID token is verified locally against the realm's published keys (the shared
 * `OidcEmailSignInService` of `@gauzy/auth`). Only a verified e-mail address is handed on to
 * Gauzy's existing social sign-in, which signs the person in to the account that owns that address;
 * nothing is created for an unknown address.
 */
@Injectable()
export class KeycloakSignInService {
	private readonly logger = new Logger(KeycloakSignInService.name);
	private readonly flow: OidcEmailSignInFlow | null;

	constructor(
		private readonly configService: ConfigService,
		private readonly signIn: OidcEmailSignInService
	) {
		this.flow = this.resolveFlow();
		if (!this.flow) {
			this.logger.warn('Keycloak sign-in is enabled but KEYCLOAK_AUTH_SERVER_URL or KEYCLOAK_REALM is missing.');
		}
	}

	/** What the login page needs to know. */
	publicConfig(): KeycloakPublicConfig {
		return this.flow ? { enabled: true } : { enabled: false, reason: 'unconfigured' };
	}

	/**
	 * Starts a sign-in: writes the transaction cookie and returns the Keycloak authorize URL (or the
	 * login page with an error code when the realm cannot be reached).
	 *
	 * @param response - The response that will redirect.
	 * @returns The URL to redirect to.
	 */
	async start(response: OidcCookieResponse): Promise<string> {
		return this.signIn.start(response, this.requireFlow());
	}

	/**
	 * Completes a sign-in callback.
	 *
	 * @param request - The callback request.
	 * @param response - The callback response.
	 * @param query - The `code`, `state` and `error` query parameters.
	 * @returns The verified e-mail, or why there is none.
	 */
	async complete(request: OidcCookieRequest, response: OidcCookieResponse, query: OidcCallbackQuery): Promise<KeycloakSignInResult> {
		return this.signIn.complete(request, response, this.requireFlow(), query);
	}

	/** Where the browser goes when a sign-in cannot complete. */
	loginPageUrl(reason: string): string {
		return this.signIn.loginPageUrl(reason);
	}

	private requireFlow(): OidcEmailSignInFlow {
		if (!this.flow) {
			throw new NotFoundException();
		}
		return this.flow;
	}

	private resolveFlow(): OidcEmailSignInFlow | null {
		const clientId = this.configService.get<string>('keycloak.clientId')?.trim();
		const clientSecret = this.configService.get<string>('keycloak.clientSecret')?.trim();
		const realm = this.configService.get<string>('keycloak.realm')?.trim();
		const authServerURL = this.configService.get<string>('keycloak.authServerURL')?.trim();
		const callbackURL = this.configService.get<string>('keycloak.callbackURL')?.trim();

		if (isMissingOrPlaceholder(clientId) || isMissingOrPlaceholder(clientSecret) || !realm || isMissingOrSampleAuthServerUrl(authServerURL)) {
			return null;
		}
		return {
			config: {
				issuer: `${stripTrailingSlashes(authServerURL)}/realms/${encodeURIComponent(realm)}`,
				clientId,
				clientSecret,
				redirectUri: callbackURL || `${stripTrailingSlashes(environment.baseUrl)}/api/auth/keycloak/callback`,
				scopes: KEYCLOAK_SCOPES
			},
			cookieName: KEYCLOAK_TRANSACTION_COOKIE,
			label: 'Keycloak'
		};
	}
}
