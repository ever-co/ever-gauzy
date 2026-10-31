import { Injectable, Logger } from '@nestjs/common';
import { environment } from '@gauzy/config';
import { isOidcError } from './errors';
import { OidcClientService } from './oidc-client.service';
import { stripTrailingSlashes } from './oidc-discovery.service';
import { OidcCookieRequest, OidcCookieResponse, OidcTransactionService } from './oidc-transaction.service';
import { OidcIssuerConfig, OidcTransactionCookieOptions } from './oidc.types';

/** Transaction mode of a sign-in started by {@link OidcEmailSignInService}. */
const SIGN_IN_MODE = 'signin';

/** The verified e-mail address of a completed sign-in, or why there is none. */
export type OidcEmailSignInResult =
	| { status: 'verified'; email: string }
	| { status: 'email_unverified' }
	| { status: 'failed' };

/** One provider plugin's sign-in: the issuer, the plugin's own cookie and its name in log lines. */
export interface OidcEmailSignInFlow {
	/** Issuer and client settings. */
	config: OidcIssuerConfig;
	/** Name of the transaction cookie. Each plugin uses its own, so two flows never clobber each other. */
	cookieName: string;
	/** Name of the sign-in method in log lines (for example `Keycloak`). Never a secret. */
	label: string;
}

/** The query parameters of an authorization callback. */
export interface OidcCallbackQuery {
	code?: string;
	state?: string;
	error?: string;
}

/**
 * Reads the library's error code of a failure, for a log line.
 *
 * @param error - Anything caught in a `catch` block.
 * @returns The code, or `unexpected error`.
 */
function failureCode(error: unknown): string {
	return isOidcError(error) ? error.code : 'unexpected error';
}

/**
 * Sign-in by verified e-mail address: the browser flow a provider plugin runs on this library.
 *
 * `start` writes the signed transaction cookie (PKCE verifier, `state`, `nonce`) and returns the issuer's
 * authorize URL. `complete` consumes that cookie (a transaction is accepted once, and only by the issuer and
 * mode that started it), exchanges the code, validates the ID token and hands back the e-mail address only when
 * the issuer reports it verified. What happens with the address (Gauzy's social sign-in, the register page) is
 * the plugin's decision. A browser never sees more than an error code on the login page, and a log line carries
 * the library's error code only: never a token, a code or an address.
 */
@Injectable()
export class OidcEmailSignInService {
	private readonly logger = new Logger(OidcEmailSignInService.name);

	constructor(
		private readonly transactions: OidcTransactionService,
		private readonly client: OidcClientService
	) {}

	/**
	 * Starts a sign-in.
	 *
	 * @param response - The response that will redirect (the transaction cookie is written on it).
	 * @param flow - The plugin's issuer, cookie and label.
	 * @returns The issuer's authorize URL, or the login page with an error code when the issuer cannot be reached.
	 */
	async start(response: OidcCookieResponse, flow: OidcEmailSignInFlow): Promise<string> {
		try {
			const transaction = await this.transactions.begin(response, this.cookie(flow), {
				issuer: flow.config.issuer,
				mode: SIGN_IN_MODE
			});
			return await this.client.buildAuthorizeUrl(flow.config, transaction);
		} catch (error) {
			this.logger.warn(`${flow.label} sign-in could not start: ${failureCode(error)}`);
			return this.loginPageUrl('sign_in_failed');
		}
	}

	/**
	 * Completes a sign-in callback.
	 *
	 * @param request - The callback request (carries the transaction cookie).
	 * @param response - The callback response (the cookie is cleared on it).
	 * @param flow - The plugin's issuer, cookie and label.
	 * @param query - The `code`, `state` and `error` query parameters.
	 * @returns The verified e-mail address, or why there is none.
	 */
	async complete(
		request: OidcCookieRequest,
		response: OidcCookieResponse,
		flow: OidcEmailSignInFlow,
		query: OidcCallbackQuery
	): Promise<OidcEmailSignInResult> {
		try {
			const transaction = await this.transactions.complete(request, response, this.cookie(flow), query.state);
			if (transaction.issuer !== flow.config.issuer || transaction.mode !== SIGN_IN_MODE) {
				this.logger.warn(`${flow.label} sign-in failed: the transaction belongs to another flow`);
				return { status: 'failed' };
			}
			if (query.error || !query.code) {
				return { status: 'failed' };
			}
			const { idToken } = await this.client.exchangeCode(flow.config, query.code, transaction);
			if (!idToken.emailVerified || !idToken.email) {
				return { status: 'email_unverified' };
			}
			return { status: 'verified', email: idToken.email };
		} catch (error) {
			this.logger.warn(`${flow.label} sign-in failed: ${failureCode(error)}`);
			return { status: 'failed' };
		}
	}

	/**
	 * Where the browser goes when a sign-in cannot complete: the web app's login page with an error code.
	 *
	 * @param reason - The error code (for example `sign_in_failed` or `email_unverified`).
	 * @returns The login page URL.
	 */
	loginPageUrl(reason: string): string {
		return `${stripTrailingSlashes(environment.clientBaseUrl)}/#/auth/login?error=${encodeURIComponent(reason)}`;
	}

	private cookie(flow: OidcEmailSignInFlow): OidcTransactionCookieOptions {
		return {
			name: flow.cookieName,
			secure: String(environment.baseUrl).startsWith('https://')
		};
	}
}
