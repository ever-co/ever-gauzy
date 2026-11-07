import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import {
	OidcClientService,
	OidcCookieRequest,
	OidcCookieResponse,
	OidcTransactionCookieOptions,
	OidcTransactionService,
	OidcValidatedIdToken,
	isOidcError
} from '@gauzy/auth';
import { ID } from '@gauzy/contracts';
import { signinScopes } from '../auth-zitadel.config';
import { ZITADEL_TRANSACTION_COOKIE } from '../auth-zitadel.tokens';
import { ZitadelConfigService } from './zitadel-config.service';
import { isProvisionKey, ZitadelHandoffService } from './zitadel-handoff.service';
import { ZitadelLinkService } from './zitadel-link.service';
import { ZitadelRefreshTokenService } from './zitadel-refresh-token.service';
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
	// A browser drops tab, CR and LF from a URL before it resolves it, so `/\t/evil.example` passed every check
	// below and then navigated to `//evil.example`. No path the web app routes to carries a control character.
	// eslint-disable-next-line no-control-regex
	if (/[\u0000-\u001f\u007f]/.test(redirect)) {
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
 *
 * While the App Launcher keeps refresh tokens (`EVER_APP_LAUNCHER_ENABLED=true`, see
 * {@link ZitadelRefreshTokenService}), a sign-in (not a link, not a workspace confirmation) also asks for
 * `offline_access`, and a linked sign-in keeps the refresh token, encrypted, with its session records. Otherwise the
 * request and the callback are exactly as without it.
 */
@Injectable()
export class ZitadelFlowService {
	private readonly logger = new Logger(ZitadelFlowService.name);

	constructor(
		private readonly config: ZitadelConfigService,
		private readonly transactions: OidcTransactionService,
		private readonly client: OidcClientService,
		private readonly signin: ZitadelSigninService,
		private readonly links: ZitadelLinkService,
		private readonly handoffs: ZitadelHandoffService,
		@Optional() private readonly refreshTokens?: ZitadelRefreshTokenService
	) {}

	/**
	 * Starts a sign-in. With `provision` (the opaque key of a workspace Ever Platform asked this
	 * installation to create, shape-checked here), the key rides in the signed transaction cookie only
	 * and the callback leads to that workspace's confirmation instead of a sign-in.
	 *
	 * @returns The authorize URL to redirect to.
	 */
	async startSignin(response: OidcCookieResponse, redirect?: string, provision?: string): Promise<string> {
		// A malformed provisioning key is refused before anything else, the issuer included.
		if (provision !== undefined && !isProvisionKey(provision)) {
			return this.errorUrl('signin', 'sign_in_failed');
		}
		try {
			const issuer = await this.config.primary();
			const path = provision ? undefined : safeRedirect(redirect, this.config.settings.clientBaseUrl);
			const transaction = await this.transactions.begin(response, this.cookie(), {
				issuer: issuer.issuer,
				mode: 'signin',
				payload: provision ? { provision } : path ? { redirect: path } : undefined
			});
			// A workspace confirmation keeps no refresh token, so it never asks for one.
			const keep = !provision && !!this.refreshTokens?.keeping;
			return await this.client.buildAuthorizeUrl({ ...issuer, scopes: signinScopes(issuer.scopes, keep) }, transaction);
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
			const { idToken, refreshToken } = await this.client.exchangeCode(issuer, query.code, transaction);
			if (mode === 'link') {
				return this.links.callback(transaction.payload?.['userId'] as ID, idToken);
			}
			const provision = transaction.payload?.['provision'];
			if (provision !== undefined) {
				return this.provisionUrl(idToken, provision);
			}
			const redirect = transaction.payload?.['redirect'];
			// Encrypted at once; the plain refresh token goes no further than this line.
			const everRefreshTokenEncrypted = this.refreshTokens?.seal(issuer.issuer, idToken.sid, refreshToken) ?? null;
			const outcome = await this.signin.decide(idToken, 'browser', { redirect, everRefreshTokenEncrypted });
			return this.outcomeUrl(outcome, redirect);
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

	/**
	 * A sign-in started to confirm a workspace: nothing is linked and nobody is signed in; the verified
	 * identity is kept under a one-time key for the confirmation page, which gets both opaque keys.
	 */
	private async provisionUrl(idToken: OidcValidatedIdToken, provision: unknown): Promise<string> {
		if (!idToken.emailVerified || !idToken.email) {
			return `${this.config.settings.clientBaseUrl}/#/auth/ever-id?error=email_unverified`;
		}
		const key = isProvisionKey(provision) ? await this.handoffs.create(idToken, provision) : null;
		if (!key) {
			return this.errorUrl('signin', 'sign_in_failed');
		}
		return `${this.config.settings.clientBaseUrl}/#/auth/ever-connect/provision?provision=${provision}&handoff=${key}`;
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
