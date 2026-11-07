import { Inject, Injectable, Optional } from '@nestjs/common';
import { EVER_ID_SESSION_TOKENS, EverIdIssuedToken, EverIdSessionTokensPort } from '@gauzy/plugin-auth-zitadel';
import { EVER_CONNECT_CLOCK } from '../ever-connect.constants';
import { EVER_CONNECT_LAUNCHER_SETTINGS, LauncherConfig } from './launcher-config';

/** The scope of the token the organization's apps are read with: read-only, and nothing else. */
export const LAUNCHER_SCOPE = 'apps:read';

/** The most delegated tokens this process holds at once (one per person and Ever ID session in use). */
const MAX_CACHED_TOKENS = 5000;

/** The person has no Ever ID session that can read their apps (they signed in some other way, or signed out). */
export interface NoEverIdSession {
	kind: 'no_session';
}

/** A token for Ever Platform with `apps:read` only, held in this process's memory until a minute before it expires. */
export interface DelegatedToken {
	kind: 'token';
	token: string;
	expiresAt: number;
}

/** Why no token could be had (a code only). */
export class LauncherTokenError extends Error {
	constructor(readonly code: 'not_configured' | 'exchange_failed') {
		super(`The App Launcher could not get a token for Ever Platform (${code}).`);
		this.name = 'LauncherTokenError';
	}
}

/**
 * The token the App Launcher reads a person's organization apps with: the person's Ever ID token exchanged (RFC 8693,
 * at Ever ID, through the Ever ID sign-in plugin's `EVER_ID_SESSION_TOKENS`) for `scope=apps:read` with Ever
 * Platform's audience (`EVER_PLATFORM_PROJECT_ID`). Ever Platform answers such a token on two reads only, and only for
 * an organization the person belongs to.
 *
 * The token lives in this process's memory only, per person and Ever ID session, until a minute before it expires
 * (an hour at most): one exchange per person and session in that time, concurrent requests included. It is never
 * stored, never sent to the browser, never put in an address and never logged. The person's session is looked up on
 * every request, so a token stops being used as soon as its session ends (a sign-out from Ever ID).
 */
@Injectable()
export class EverConnectLauncherTokenService {
	private readonly tokens = new Map<string, EverIdIssuedToken>();
	private readonly pending = new Map<string, Promise<EverIdIssuedToken | null>>();
	private readonly nowSeconds: () => number;

	constructor(
		@Inject(EVER_CONNECT_LAUNCHER_SETTINGS) private readonly config: LauncherConfig,
		@Optional() @Inject(EVER_ID_SESSION_TOKENS) private readonly sessions?: EverIdSessionTokensPort,
		@Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }
	) {
		this.nowSeconds = () => Math.floor((clock ?? Date).now() / 1000);
	}

	/** The person's Ever ID session that can read their apps, or `null`. */
	async sessionOf(userId: string): Promise<string | null> {
		return this.sessions ? this.sessions.sessionOf(userId) : null;
	}

	/**
	 * The delegated token of the person in the Ever ID session `sid` (see {@link sessionOf}).
	 *
	 * @throws LauncherTokenError when Ever Platform's audience is not configured or Ever ID refuses the exchange.
	 */
	async delegatedToken(userId: string, sid: string): Promise<DelegatedToken | NoEverIdSession> {
		if (!this.sessions) {
			return { kind: 'no_session' };
		}
		if (!this.config.audience) {
			throw new LauncherTokenError('not_configured');
		}
		const key = `${userId}|${sid}`;
		const cached = this.tokens.get(key);
		if (cached && cached.expiresAt > this.nowSeconds()) {
			return { kind: 'token', token: cached.token, expiresAt: cached.expiresAt };
		}
		this.tokens.delete(key);
		let request = this.pending.get(key);
		if (!request) {
			request = this.exchange(sid).finally(() => this.pending.delete(key));
			this.pending.set(key, request);
		}
		const issued = await request;
		if (!issued) {
			return { kind: 'no_session' };
		}
		this.remember(key, issued);
		return { kind: 'token', token: issued.token, expiresAt: issued.expiresAt };
	}

	private async exchange(sid: string): Promise<EverIdIssuedToken | null> {
		try {
			return await this.sessions.exchange(sid, { audience: this.config.audience, scope: LAUNCHER_SCOPE });
		} catch {
			// The port reports a code only; nothing of the request is kept or passed on.
			throw new LauncherTokenError('exchange_failed');
		}
	}

	private remember(key: string, issued: EverIdIssuedToken): void {
		const now = this.nowSeconds();
		if (issued.expiresAt <= now) {
			return;
		}
		if (this.tokens.size >= MAX_CACHED_TOKENS) {
			for (const [other, token] of this.tokens) {
				if (token.expiresAt <= now) this.tokens.delete(other);
			}
			// Still full: the oldest go first (a Map keeps insertion order).
			for (const other of this.tokens.keys()) {
				if (this.tokens.size < MAX_CACHED_TOKENS) break;
				this.tokens.delete(other);
			}
		}
		this.tokens.set(key, issued);
	}
}
