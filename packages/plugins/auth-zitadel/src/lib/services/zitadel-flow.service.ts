import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
	OidcClientService,
	OidcCookieRequest,
	OidcCookieResponse,
	OidcTransactionCookieOptions,
	OidcTransactionService,
	isOidcError
} from '@gauzy/auth';
import { ID } from '@gauzy/contracts';
import { ZITADEL_TRANSACTION_COOKIE } from '../auth-zitadel.tokens';
import { ZitadelConfigService } from './zitadel-config.service';
import { ZitadelLinkService } from './zitadel-link.service';
import { ZitadelSigninOutcome, ZitadelSigninService } from './zitadel-signin.service';

/** Longest accepted `redirect` path. */
const MAX_REDIRECT_LENGTH = 512;

/**
 * Accepts a client path to return to after signing in: a path on the web app's own origin only.
 *
 * @param redirect - The `redirect` query parameter.
 * @param clientBaseUrl - The web app origin.
 * @returns A safe path (starting with one `/`), or `undefined`.
 */
export function safeRedirect(redirect: unknown, clientBaseUrl: string): string | undefined {
	if (typeof redirect !== 'string' || !redirect || redirect.length > MAX_REDIRECT_LENGTH) {
		return undefined;
	}
	let candidate = redirect;
	if (/^https?:\/\//i.test(candidate)) {
		try {
			const url = new URL(candidate);
			if (url.origin !== new URL(clientBaseUrl).origin) {
				return undefined;
			}
			candidate = `${url.pathname}${url.search}${url.hash}`;
		} catch {
			return undefined;
		}
	}
	if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
		return undefined;
	}
	return candidate;
}

/**
 * The browser side of the flow: starting a sign-in or a link, and handling the callback.
 *
 * The authorize request carries PKCE, `state` and `nonce` (kept in a signed cookie) and never a
 * `login_hint`, so no e-mail address or other personal data ends up in a URL. Every redirect back to
 * the web app carries only an opaque one-time key or an error code.
 */
@Injectable()
export class ZitadelFlowService {
	private readonly logger = new Logger(ZitadelFlowService.name);

	constructor(
		private readonly config: ZitadelConfigService,
		private readonly transactions: OidcTransactionService,
		private readonly client: OidcClientService,
		private readonly signin: ZitadelSigninService,
		private readonly links: ZitadelLinkService
	) {}

	/**
	 * Starts a sign-in.
	 *
	 * @returns The authorize URL to redirect to.
	 */
	async startSignin(response: OidcCookieResponse, redirect?: string): Promise<string> {
		try {
			const issuer = await this.config.primary();
			const path = safeRedirect(redirect, this.config.settings.clientBaseUrl);
			const transaction = await this.transactions.begin(response, this.cookie(), {
				issuer: issuer.issuer,
				mode: 'signin',
				payload: path ? { redirect: path } : undefined
			});
			return await this.client.buildAuthorizeUrl(issuer, transaction);
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			this.logger.warn(`Ever ID sign-in could not start: ${isOidcError(error) ? error.code : 'unexpected error'}`);
			return this.errorUrl('signin', 'sign_in_failed');
		}
	}

	/**
	 * Starts a link for the user a link ticket was issued to: a fresh login (`prompt=login`,
	 * `max_age=300`) is required.
	 *
	 * @returns The authorize URL to redirect to.
	 */
	async startLink(response: OidcCookieResponse, ticket: string): Promise<string> {
		const userId = await this.links.redeemTicket(ticket);
		try {
			const issuer = await this.config.primary();
			const transaction = await this.transactions.begin(response, this.cookie(), {
				issuer: issuer.issuer,
				mode: 'link',
				payload: { userId }
			});
			return await this.client.buildAuthorizeUrl(issuer, transaction, { prompt: 'login', maxAge: 300 });
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			this.logger.warn(`Ever ID link could not start: ${isOidcError(error) ? error.code : 'unexpected error'}`);
			return this.errorUrl('link', 'link_failed');
		}
	}

	/**
	 * Handles the issuer's redirect back.
	 *
	 * @returns The web app URL to redirect to.
	 */
	async callback(
		request: OidcCookieRequest,
		response: OidcCookieResponse,
		query: { code?: string; state?: string; error?: string }
	): Promise<string> {
		let mode = 'signin';
		try {
			const transaction = await this.transactions.complete(request, response, this.cookie(), query.state);
			mode = transaction.mode;
			const issuer = await this.config.issuer(transaction.issuer);
			if (!issuer) {
				return this.errorUrl(mode, 'sign_in_failed');
			}
			if (query.error || !query.code) {
				return this.errorUrl(mode, query.error === 'access_denied' ? 'cancelled' : 'sign_in_failed');
			}
			const { idToken } = await this.client.exchangeCode(issuer, query.code, transaction);
			if (mode === 'link') {
				return this.links.callback(transaction.payload?.['userId'] as ID, idToken);
			}
			const outcome = await this.signin.decide(idToken, 'browser');
			return this.outcomeUrl(outcome, transaction.payload?.['redirect']);
		} catch (error) {
			this.logger.warn(`Ever ID callback failed: ${isOidcError(error) ? error.code : 'unexpected error'}`);
			return this.errorUrl(mode, 'sign_in_failed');
		}
	}

	private async outcomeUrl(outcome: ZitadelSigninOutcome, redirect?: string): Promise<string> {
		const base = `${this.config.settings.clientBaseUrl}/#/auth`;
		switch (outcome.type) {
			case 'workspaces':
				return `${base}/ever-id?handoff=${await this.signin.handOff(outcome.response, redirect)}`;
			case 'confirm':
				return `${base}/ever-id/confirm?handoff=${outcome.key}`;
			case 'signup':
				return `${base}/ever-id/signup?handoff=${outcome.key}`;
			case 'register':
				return `${base}/register?ever_id=1&handoff=${outcome.key}`;
			case 'email_unverified':
				return `${base}/ever-id?error=email_unverified`;
			default:
				return `${base}/ever-id?error=sign_in_failed`;
		}
	}

	private errorUrl(mode: string, error: string): string {
		const base = this.config.settings.clientBaseUrl;
		return mode === 'link'
			? `${base}/#/pages/settings/connected-identities?error=${error}`
			: `${base}/#/auth/ever-id?error=${error}`;
	}

	private cookie(): OidcTransactionCookieOptions {
		return { name: ZITADEL_TRANSACTION_COOKIE, secure: this.config.settings.secureCookies };
	}
}
