import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { OidcDiscoveryService, OidcHttpService, OidcIssuerConfig } from '@gauzy/auth';
import { ZitadelSession } from '../entities/zitadel-session.entity';
import {
	EVER_ID_TOKEN_VAULT,
	EverIdExchangeError,
	EverIdExchangeRequest,
	EverIdIssuedToken,
	EverIdSessionTokensPort,
	EverIdTokenVaultPort
} from '../ports/ever-id-session-tokens.port';
import { ZitadelConfigService } from './zitadel-config.service';

/** A token is used until this many seconds before it expires. */
export const TOKEN_EXPIRY_MARGIN_S = 60;

/** The longest lifetime used for an exchanged token, seconds, whatever the issuer says. */
export const MAX_EXCHANGED_TOKEN_LIFETIME_S = 3600;

/** RFC 8693 token exchange. */
export const TOKEN_EXCHANGE_GRANT = 'urn:ietf:params:oauth:grant-type:token-exchange';

/** RFC 8693 token type of an OAuth access token. */
export const ACCESS_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:access_token';

/** What the encrypted column holds (as JSON, inside the ciphertext): the refresh token and its issuer. */
interface KeptRefreshToken {
	v: 1;
	issuer: string;
	refreshToken: string;
}

/** A fresh access token of one Ever ID session, in this process's memory only. */
interface SessionAccessToken {
	token: string;
	/** Seconds since the epoch, already shortened by {@link TOKEN_EXPIRY_MARGIN_S}. */
	usableUntil: number;
	issuer: string;
}

/**
 * `client_secret_basic` (RFC 6749, section 2.3.1): id and secret are form-encoded before they are joined. The same
 * rule the shared OpenID Connect library applies to the code exchange.
 */
function clientCredential(clientId: string, clientSecret: string): string {
	const encode = (value: string) => new URLSearchParams({ v: value }).toString().slice(2);
	return `Basic ${Buffer.from(`${encode(clientId)}:${encode(clientSecret)}`).toString('base64')}`;
}

/** The OAuth `error` of a refused token request, when the answer names one. */
function oauthError(data: unknown): string | null {
	const error = (data as { error?: unknown } | null)?.['error'];
	return typeof error === 'string' ? error : null;
}

/**
 * The Ever ID refresh token each Ever ID session keeps for the App Launcher, and the tokens made from it.
 *
 * Only while `EVER_APP_LAUNCHER_ENABLED=true` and this installation can encrypt it does a browser sign-in ask for
 * `offline_access` and keep the refresh token, in `zitadel_session.everRefreshTokenEncrypted`, with the issuer it
 * came from. The encryption is the Ever Platform connection plugin's ({@link EVER_ID_TOKEN_VAULT}: AES-256-GCM under
 * `ENCRYPTION_KEY`, or a `JWT_SECRET` that is not a published default, exactly as the installation's keys are
 * stored, with a purpose of its own bound into the ciphertext); this plugin never imports that plugin. Without it,
 * or without a safe secret, nothing is asked for and nothing is kept.
 *
 * - {@link accessTokenFor}: a fresh access token of a session, from a refresh grant with this installation's client
 *   at the same issuer. The rotated refresh token replaces the stored one; the access token stays in this
 *   process's memory until a minute before it expires. A refresh token the issuer refuses (`invalid_grant`) is
 *   removed: the person signs in with Ever ID again.
 * - {@link exchange}: RFC 8693 token exchange of that access token for another audience and scope (the App
 *   Launcher asks for `apps:read` on Ever Platform). The answer is handed to the caller and never stored here.
 *
 * The kept token goes with its session record: on a back-channel logout, a person's data deletion request, the
 * daily pruning of old session records, and at the next pruning after the launcher was switched off. No token is
 * ever logged, put in a URL or returned by a route.
 */
@Injectable()
export class ZitadelRefreshTokenService implements EverIdSessionTokensPort, OnModuleInit {
	private readonly logger = new Logger(ZitadelRefreshTokenService.name);
	/** Fresh access tokens by session id, this process only. */
	private readonly accessTokens = new Map<string, SessionAccessToken>();
	/** One refresh at a time per session: a rotated refresh token is used once. */
	private readonly refreshing = new Map<string, Promise<SessionAccessToken | null>>();

	constructor(
		private readonly config: ZitadelConfigService,
		@InjectRepository(ZitadelSession) private readonly sessions: Repository<ZitadelSession>,
		private readonly discovery: OidcDiscoveryService,
		private readonly http: OidcHttpService,
		@Optional() @Inject(EVER_ID_TOKEN_VAULT) private readonly vault?: EverIdTokenVaultPort
	) {}

	onModuleInit(): void {
		if (!this.config.settings.launcherEnabled) {
			return;
		}
		if (!this.vault) {
			this.logger.warn(
				'The App Launcher keeps no Ever ID refresh token: it needs the Ever Platform connection (EVER_CONNECT_ENABLED=true).'
			);
		} else if (!this.vault.usable()) {
			this.logger.warn(
				'The App Launcher keeps no Ever ID refresh token: set ENCRYPTION_KEY or a strong JWT_SECRET.'
			);
		}
	}

	/** Whether sign-ins keep their Ever ID refresh token (the App Launcher is on and the token can be encrypted). */
	get keeping(): boolean {
		return this.config.settings.launcherEnabled && !!this.vault?.usable();
	}

	/**
	 * The encrypted form of a sign-in's refresh token, to store with its session records, or `null` when nothing is
	 * kept: the launcher is off, the token cannot be encrypted, the issuer gave no refresh token, or the ID token
	 * names no session (`sid`), which a kept token must belong to.
	 */
	seal(issuer: string, sid: string | undefined, refreshToken: string | undefined): string | null {
		if (!this.keeping || !sid || typeof refreshToken !== 'string' || !refreshToken) {
			return null;
		}
		const kept: KeptRefreshToken = { v: 1, issuer, refreshToken };
		try {
			return this.vault.seal(JSON.stringify(kept));
		} catch {
			// The sign-in goes on without it; the App Launcher then offers to sign in with Ever ID again.
			this.logger.warn('An Ever ID refresh token could not be encrypted; it is not kept.');
			return null;
		}
	}

	/** The newest Ever ID session of the user that keeps a refresh token, or `null`. */
	async sessionOf(userId: string): Promise<string | null> {
		if (!this.keeping || !userId) {
			return null;
		}
		const row = await this.sessions.findOne({
			where: { userId, isActive: true, everRefreshTokenEncrypted: Not(IsNull()) },
			order: { createdAt: 'DESC' },
			select: { id: true, sid: true }
		});
		return row?.sid || null;
	}

	/**
	 * A fresh Ever ID access token of the session `sid`, or `null` when the session keeps no usable refresh token
	 * (none kept, ended, refused by the issuer, or its issuer is no longer configured).
	 *
	 * @throws EverIdExchangeError when the issuer cannot be reached or refuses for another reason.
	 */
	async accessTokenFor(sid: string): Promise<EverIdIssuedToken | null> {
		const fresh = await this.sessionAccessToken(sid);
		return fresh ? { token: fresh.token, expiresAt: fresh.usableUntil } : null;
	}

	/**
	 * Exchanges the session's access token (RFC 8693) for a token of `request.audience` with `request.scope`, at the
	 * session's issuer with this installation's client. Its lifetime is capped at
	 * {@link MAX_EXCHANGED_TOKEN_LIFETIME_S}. Nothing of it is kept here.
	 *
	 * @returns The token, or `null` when the session can give none (see {@link accessTokenFor}).
	 * @throws EverIdExchangeError when the issuer cannot be reached or refuses the exchange.
	 */
	async exchange(sid: string, request: EverIdExchangeRequest): Promise<EverIdIssuedToken | null> {
		const subject = await this.sessionAccessToken(sid);
		if (!subject) {
			return null;
		}
		const issuer = await this.config.issuer(subject.issuer);
		if (!issuer?.clientSecret) {
			throw new EverIdExchangeError('not_configured');
		}
		const answer = await this.tokenRequest(issuer, {
			grant_type: TOKEN_EXCHANGE_GRANT,
			subject_token: subject.token,
			subject_token_type: ACCESS_TOKEN_TYPE,
			requested_token_type: ACCESS_TOKEN_TYPE,
			audience: request.audience,
			scope: request.scope
		});
		if (answer.status !== 200) {
			if (oauthError(answer.data) === 'invalid_grant') {
				// The access token itself was refused (revoked meanwhile): the next call refreshes it first.
				this.accessTokens.delete(sid);
			}
			this.logger.warn(
				`Ever ID refused a token exchange (${answer.status} ${oauthError(answer.data) ?? 'no error code'}).`
			);
			throw new EverIdExchangeError(answer.status >= 500 ? 'issuer_unreachable' : 'exchange_refused');
		}
		const body = (answer.data ?? {}) as Record<string, unknown>;
		const token = body['access_token'];
		if (typeof token !== 'string' || !token) {
			throw new EverIdExchangeError('invalid_answer');
		}
		const lifetime = Math.min(Number(body['expires_in']) || 0, MAX_EXCHANGED_TOKEN_LIFETIME_S);
		return { token, expiresAt: this.nowSeconds() + lifetime - TOKEN_EXPIRY_MARGIN_S };
	}

	/** Current time in seconds; a method so tests can move the clock. */
	protected nowSeconds(): number {
		return Math.floor(Date.now() / 1000);
	}

	/** The session's access token: from memory while it is usable and the session still keeps a token, else refreshed. */
	private async sessionAccessToken(sid: string): Promise<SessionAccessToken | null> {
		if (!this.keeping || !sid) {
			return null;
		}
		const row = await this.keptRow(sid);
		if (!row) {
			// The session ended (or its token was removed) on this or another replica.
			this.accessTokens.delete(sid);
			return null;
		}
		const cached = this.accessTokens.get(sid);
		if (cached && cached.usableUntil > this.nowSeconds()) {
			return cached;
		}
		let pending = this.refreshing.get(sid);
		if (!pending) {
			pending = this.refresh(sid, row.everRefreshTokenEncrypted).finally(() => this.refreshing.delete(sid));
			this.refreshing.set(sid, pending);
		}
		return pending;
	}

	/** The newest record of a session that keeps a token, with the encrypted token. */
	private keptRow(sid: string): Promise<Pick<ZitadelSession, 'id' | 'everRefreshTokenEncrypted'> | null> {
		return this.sessions.findOne({
			where: { sid, isActive: true, everRefreshTokenEncrypted: Not(IsNull()) },
			order: { createdAt: 'DESC' },
			select: { id: true, everRefreshTokenEncrypted: true }
		});
	}

	/** A refresh grant with the session's kept refresh token; stores the rotated one. */
	private async refresh(sid: string, blob: string): Promise<SessionAccessToken | null> {
		const kept = this.open(blob);
		if (!kept) {
			// Not readable with this process's secrets any more (the secret changed): it can never be used.
			await this.removeKept(sid, blob);
			return null;
		}
		const issuer = await this.config.issuer(kept.issuer);
		if (!issuer?.clientSecret) {
			// The issuer is not in effect right now: keep the token, give nothing.
			return null;
		}
		const answer = await this.tokenRequest(issuer, {
			grant_type: 'refresh_token',
			refresh_token: kept.refreshToken
		});
		if (answer.status !== 200) {
			if (oauthError(answer.data) === 'invalid_grant') {
				this.logger.warn(
					'Ever ID refused a kept refresh token; it is removed (the person signs in with Ever ID again).'
				);
				await this.removeKept(sid, blob);
				return null;
			}
			this.logger.warn(
				`Ever ID refused a refresh (${answer.status} ${oauthError(answer.data) ?? 'no error code'}).`
			);
			throw new EverIdExchangeError(answer.status >= 500 ? 'issuer_unreachable' : 'exchange_refused');
		}
		const body = (answer.data ?? {}) as Record<string, unknown>;
		const token = body['access_token'];
		if (typeof token !== 'string' || !token) {
			throw new EverIdExchangeError('invalid_answer');
		}
		const rotated = body['refresh_token'];
		if (typeof rotated === 'string' && rotated && rotated !== kept.refreshToken) {
			const sealed = this.seal(kept.issuer, sid, rotated);
			// Only where the token just used is still stored: a rotation another replica stored meanwhile is kept.
			await this.sessions.update({ sid, everRefreshTokenEncrypted: blob }, { everRefreshTokenEncrypted: sealed });
		}
		const fresh: SessionAccessToken = {
			token,
			usableUntil: this.nowSeconds() + (Number(body['expires_in']) || 0) - TOKEN_EXPIRY_MARGIN_S,
			issuer: kept.issuer
		};
		if (fresh.usableUntil > this.nowSeconds()) {
			this.accessTokens.set(sid, fresh);
		}
		return fresh;
	}

	/** Sends one form request to the issuer's token endpoint with this installation's client credential. */
	private async tokenRequest(
		issuer: OidcIssuerConfig,
		form: Record<string, string>
	): Promise<{ status: number; data: unknown }> {
		try {
			const document = await this.discovery.get(issuer.issuer, issuer.discoveryDocument);
			return await this.http.postForm(document.token_endpoint, form, {
				Authorization: clientCredential(issuer.clientId, issuer.clientSecret)
			});
		} catch {
			// Never the error itself: an HTTP client error can carry the request, and with it the token.
			throw new EverIdExchangeError('issuer_unreachable');
		}
	}

	/** Removes a kept token, only where it is still the one stored. */
	private async removeKept(sid: string, blob: string): Promise<void> {
		this.accessTokens.delete(sid);
		await this.sessions.update({ sid, everRefreshTokenEncrypted: blob }, { everRefreshTokenEncrypted: null });
	}

	/** The kept token, or `null` when it cannot be read with this process's secrets. */
	private open(blob: string): KeptRefreshToken | null {
		let plain: string | null;
		try {
			plain = this.vault?.open(blob) ?? null;
		} catch {
			return null;
		}
		if (!plain) {
			return null;
		}
		try {
			const kept = JSON.parse(plain) as Partial<KeptRefreshToken>;
			return kept?.v === 1 && typeof kept.issuer === 'string' && typeof kept.refreshToken === 'string'
				? (kept as KeptRefreshToken)
				: null;
		} catch {
			return null;
		}
	}
}
