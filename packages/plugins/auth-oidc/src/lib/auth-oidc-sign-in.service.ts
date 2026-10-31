import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
	OidcCallbackQuery,
	OidcCookieRequest,
	OidcCookieResponse,
	OidcEmailSignInFlow,
	OidcEmailSignInResult,
	OidcEmailSignInService
} from '@gauzy/auth';
import { environment } from '@gauzy/config';
import { AuthOidcSettings } from './auth-oidc.config';
import { AUTH_OIDC_SETTINGS } from './auth-oidc.tokens';

/** Cookie that carries the sign-in transaction between the start and the callback. */
export const OIDC_TRANSACTION_COOKIE = 'gauzy_oidc_txn';

/** Path of the callback route below the API base URL. */
export const OIDC_CALLBACK_PATH = '/api/auth/oidc/callback';

/** The answer of `GET /api/auth/oidc/config`. */
export type AuthOidcPublicConfig = { enabled: true; displayName: string } | { enabled: false; reason: 'unconfigured' };

/** Drops trailing slashes without a regular expression. */
function stripTrailingSlashes(value: string): string {
	let end = value.length;
	while (end > 0 && value.charAt(end - 1) === '/') {
		end--;
	}
	return value.slice(0, end);
}

/**
 * Sign-in with any standards-compliant OpenID Connect provider, on the shared OIDC library.
 *
 * The authorization code flow runs with PKCE, `state` and `nonce` kept in a signed cookie, and the ID
 * token is verified locally against the provider's published keys (the shared `OidcEmailSignInService`
 * of `@gauzy/auth`). Only an e-mail address the provider reports as verified is handed on to Gauzy's
 * existing social sign-in, which signs the person in to the account that owns that address; nothing is
 * created for an unknown address.
 */
@Injectable()
export class AuthOidcSignInService {
	private readonly logger = new Logger(AuthOidcSignInService.name);
	private readonly flow: OidcEmailSignInFlow | null;

	constructor(
		@Inject(AUTH_OIDC_SETTINGS) private readonly settings: AuthOidcSettings,
		private readonly signIn: OidcEmailSignInService
	) {
		this.flow = this.resolveFlow();
		if (!this.flow) {
			const names = settings.unusable.map(({ name }) => name).join(', ');
			this.logger.warn(`OpenID Connect sign-in is loaded but not configured${names ? ` (${names})` : ''}.`);
		}
	}

	/** What the login page needs to know: whether to show the button, and its label. */
	publicConfig(): AuthOidcPublicConfig {
		return this.flow
			? { enabled: true, displayName: this.settings.displayName }
			: { enabled: false, reason: 'unconfigured' };
	}

	/**
	 * Starts a sign-in: writes the transaction cookie and returns the provider's authorize URL (or the
	 * login page with an error code when the provider cannot be reached).
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
	 * @returns The verified e-mail address, or why there is none.
	 */
	async complete(
		request: OidcCookieRequest,
		response: OidcCookieResponse,
		query: OidcCallbackQuery
	): Promise<OidcEmailSignInResult> {
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
		const { issuer, clientId, clientSecret, scopes, callbackUrl, unusable } = this.settings;
		if (unusable.length || !issuer || !clientId || !clientSecret) {
			return null;
		}
		return {
			config: {
				issuer,
				clientId,
				clientSecret,
				redirectUri: callbackUrl || `${stripTrailingSlashes(environment.baseUrl)}${OIDC_CALLBACK_PATH}`,
				scopes
			},
			cookieName: OIDC_TRANSACTION_COOKIE,
			label: 'OpenID Connect',
			// Some providers (Zitadel, Authelia) leave the address out of the ID token: read it from userinfo then.
			userinfoFallback: true
		};
	}
}
