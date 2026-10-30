import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EverConnectConfigPort, EverIdentityContext } from '@gauzy/plugin-auth-zitadel';
import { EverConnectAuditService } from '../ever-connect-audit.service';
import type { EverConnectConfig } from '../ever-connect-config';
import {
	EVER_CONNECT_CLOCK,
	EVER_CONNECT_ENV,
	EVER_CONNECT_SETTINGS,
	OIDC_CLIENT_POLL_FIRST_MS,
	OIDC_CLIENT_POLL_MAX_MS,
	RESOLVE_TIMEOUT_MS
} from '../ever-connect.constants';
import { EverConnectPlatformService, errorCode, isCredentialRevoked, isUnreachable } from '../ever-connect-platform.service';
import { EverConnectSecretStore } from '../ever-connect-secret-store';
import { EverConnectSignals } from '../ever-connect-signals';
import { EverConnectStore } from '../ever-connect.store';
import { ProblemError } from '../sdk';

/** The integration this handler serves. */
export const EVER_ID_LOGIN = 'ever_id_login';

/**
 * What is kept (sealed) for Sign in with Ever ID: how far the hand-off of this installation's sign-in
 * client got, and the client once it was handed over.
 *
 * - `pending`: asked for; read again at `nextPollAt` (5 seconds, then less often, at most every 5 minutes);
 * - `ready`: the issuer, client id and secret, handed over once by Ever Platform;
 * - `failed`: Ever Platform could not make it, or this installation's sign-in endpoints cannot be
 *   registered (`code`); switching the integration off and on again asks again;
 * - `lost`: Ever Platform made it, but its secret did not reach this installation (it is handed over
 *   only once): enable the integration again in app.ever.co.
 */
interface SignInClientState {
	status: 'pending' | 'ready' | 'failed' | 'lost';
	jobId?: string | null;
	issuer?: string;
	clientId?: string;
	clientSecret?: string;
	polls?: number;
	nextPollAt?: number | null;
	code?: string | null;
}

/** The state of the sign-in client as the Integrations & data tab shows it (never the secret). */
export type SignInClientStatus = 'none' | SignInClientState['status'] | 'unreadable';

/** The issuer, client id and secret of the sign-in client, as the sign-in plugin uses them. */
export interface SignInClientConfig {
	issuer: string;
	clientId: string;
	clientSecret: string;
}

/** How long the configuration read for a sign-in is reused in this process. */
const CONFIG_CACHE_MS = 10_000;

const stripTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

/**
 * Sign in with Ever ID on a connected installation: this installation's own sign-in client.
 *
 * When `ever_id_login` is enabled (consented in app.ever.co and accepted by the operator), this
 * installation asks Ever Platform for its sign-in client (`POST /v1/instances/me/oidc-client`, with
 * the callback and back-channel logout endpoints of the Ever ID sign-in plugin), then reads it until
 * it is ready (`GET`, by the API process that holds the connection's lease). Ever Platform hands the
 * secret over once; it is stored sealed (AES-256-GCM, like the connection key) on the integration's
 * row, and given to the Ever ID sign-in plugin through `EVER_CONNECT_CONFIG` (where settings from the
 * environment win, key by key). Switching the integration off, its revocation and a disconnect clear
 * it; the Ever ID links of Gauzy users stay.
 *
 * It also asks Ever Platform about an identity for a sign-in whose token carries none of the
 * platform's claims (`POST /v1/identity/resolve`), for Ever Platform's own issuer only.
 */
@Injectable()
export class EverIdLoginHandler implements EverConnectConfigPort {
	private readonly logger = new Logger('EverConnect');
	private readonly now: () => number;
	private readonly secrets: EverConnectSecretStore;
	private cache: { at: number; enabled: boolean; config: SignInClientConfig | null } | null = null;
	/** Called once the sign-in client is ready (the link reporter reports the existing links then). */
	private readonly readyListeners: Array<() => Promise<void>> = [];

	constructor(
		private readonly store: EverConnectStore,
		private readonly platform: EverConnectPlatformService,
		private readonly audit: EverConnectAuditService,
		private readonly signals: EverConnectSignals,
		@Inject(EVER_CONNECT_SETTINGS) private readonly config: EverConnectConfig,
		@Optional() @Inject(EVER_CONNECT_ENV) env?: Record<string, string | undefined>,
		@Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }
	) {
		this.now = clock?.now ?? (() => Date.now());
		this.secrets = new EverConnectSecretStore(env ?? process.env);
	}

	/** Runs `listener` each time the sign-in client becomes ready. */
	onReady(listener: () => Promise<void>): void {
		this.readyListeners.push(listener);
	}

	// ── EVER_CONNECT_CONFIG (the Ever ID sign-in plugin asks) ─────────────────

	async isEverIdLoginEnabled(): Promise<boolean> {
		return (await this.cached()).enabled;
	}

	async getEverIdLoginConfig(): Promise<SignInClientConfig | null> {
		return (await this.cached()).config;
	}

	/**
	 * Ever Platform's view of an identity this installation holds a link for, or `null`: only while
	 * connected, with Sign in with Ever ID enabled and its client ready, for Ever Platform's own issuer
	 * (never a subject of another identity provider), within 6 seconds. Never throws.
	 */
	async resolveIdentity(issuer: string, subject: string, idToken?: string): Promise<EverIdentityContext | null> {
		try {
			const { config } = await this.cached();
			if (!config || stripTrailingSlashes(issuer) !== stripTrailingSlashes(config.issuer) || !subject) {
				return null;
			}
			const connection = await this.store.connection();
			if (connection.status !== 'connected' || !connection.platformInstanceId) {
				return null;
			}
			const client = await this.platform.getClient();
			let timer: NodeJS.Timeout | undefined;
			const answer = await Promise.race([
				client.identity.resolve({ issuer, subject, ...(idToken ? { id_token: idToken } : {}) }),
				new Promise<null>((resolve) => {
					timer = setTimeout(() => resolve(null), RESOLVE_TIMEOUT_MS);
					timer.unref?.();
				})
			]).finally(() => timer && clearTimeout(timer));
			return (answer as EverIdentityContext | null) ?? null;
		} catch (error) {
			if (isCredentialRevoked(error)) {
				this.signals.revoked$.next();
			} else if (!(error instanceof ProblemError && error.status === 404)) {
				this.logger.warn(`Ever Platform's view of an identity is unavailable (${errorCode(error)}).`);
			}
			return null;
		}
	}

	// ── The sign-in client's life ─────────────────────────────────────────────

	/** The state the Integrations & data tab shows. */
	async status(): Promise<SignInClientStatus> {
		const row = await this.store.integration('instance', EVER_ID_LOGIN);
		if (!row?.configEncrypted) {
			return 'none';
		}
		return this.read(row.configEncrypted)?.status ?? 'unreadable';
	}

	/**
	 * `ever_id_login` was enabled: asks for the sign-in client unless one is ready or asked for. Throws
	 * when Ever Platform could not be reached (the integration then retries at the next heartbeat).
	 */
	async enabled(): Promise<void> {
		const connection = await this.store.connection();
		const row = await this.store.integration('instance', EVER_ID_LOGIN);
		if (connection.status !== 'connected' || !connection.platformInstanceId || !row?.enabled) {
			return;
		}
		const blob = row.configEncrypted;
		const current = this.read(blob);
		if (current && (current.status === 'ready' || current.status === 'pending')) {
			return;
		}
		if (!this.config.signIn) {
			this.logger.warn(
				'Sign in with Ever ID needs an https API_BASE_URL (or ZITADEL_CALLBACK_URL) on one origin; its sign-in client is not asked for.'
			);
			await this.write(blob, { status: 'failed', code: 'endpoints_unusable' });
			return;
		}
		const { redirectUri, logoutUri } = this.config.signIn;
		let next: SignInClientState;
		try {
			const answer = (await (await this.platform.getClient()).instances.oidcClient.request(
				{ redirect_uri: redirectUri, logout_uri: logoutUri },
				sha256(`oidc-client|${connection.platformInstanceId}|${row.consentId ?? ''}|${redirectUri}|${logoutUri}`)
			)) as { status?: string; job_id?: string | null };
			next = { status: 'pending', jobId: answer?.job_id ?? null, polls: 0, nextPollAt: this.now() + OIDC_CLIENT_POLL_FIRST_MS };
		} catch (error) {
			if (isCredentialRevoked(error)) {
				this.signals.revoked$.next();
				return;
			}
			if (error instanceof ProblemError && error.status === 409 && error.code === 'oidc_client_exists') {
				// Asked for before (by another API process, or before a restart): read it.
				next = { status: 'pending', jobId: null, polls: 0, nextPollAt: this.now() };
			} else if (error instanceof ProblemError && error.status === 422) {
				next = { status: 'failed', code: error.code };
			} else if (error instanceof ProblemError && error.status === 403) {
				// Not enabled on Ever Platform (yet): the next state read says so.
				return;
			} else {
				throw error;
			}
		}
		await this.write(blob, next);
	}

	/** `ever_id_login` was switched off, revoked or the installation disconnected: the client is forgotten here. */
	async disabled(): Promise<void> {
		for (let attempt = 0; attempt < 3; attempt++) {
			const row = await this.store.integration('instance', EVER_ID_LOGIN);
			if (!row?.configEncrypted) {
				break;
			}
			if (await this.store.setIntegrationConfig('instance', EVER_ID_LOGIN, null, row.configEncrypted)) {
				await this.audit.record({
					action: 'sign_in_client.change',
					actorLabel: 'system',
					integration: EVER_ID_LOGIN,
					details: { state: 'none' }
				});
				break;
			}
		}
		this.cache = null;
	}

	/**
	 * Reads the sign-in client once when it is asked for and due (by the API process holding the
	 * connection's lease): stores it when ready (its secret, handed over once), else reads it again
	 * later. Returns whether a read was made.
	 */
	async pollDue(): Promise<boolean> {
		const row = await this.store.integration('instance', EVER_ID_LOGIN);
		const blob = row?.configEncrypted ?? null;
		const current = this.read(blob);
		if (!row?.enabled || current?.status !== 'pending' || (current.nextPollAt ?? 0) > this.now()) {
			return false;
		}
		const polls = (current.polls ?? 0) + 1;
		const later = (): SignInClientState => ({
			...current,
			polls,
			nextPollAt: this.now() + Math.min(OIDC_CLIENT_POLL_FIRST_MS * 2 ** polls, OIDC_CLIENT_POLL_MAX_MS)
		});
		let next: SignInClientState;
		try {
			const answer = (await (await this.platform.getClient()).instances.oidcClient.get()) as {
				status?: string;
				job_id?: string | null;
				issuer?: string | null;
				client_id?: string | null;
				client_secret?: string | null;
			};
			if (answer?.status === 'ready' && answer.issuer && answer.client_id && answer.client_secret) {
				next = {
					status: 'ready',
					jobId: answer.job_id ?? current.jobId ?? null,
					issuer: stripTrailingSlashes(answer.issuer),
					clientId: answer.client_id,
					clientSecret: answer.client_secret
				};
			} else if (answer?.status === 'ready') {
				// Handed over before, but not stored here: it cannot be read back.
				this.logger.warn('The Sign in with Ever ID client was handed over before and is not stored here; enable the integration again in app.ever.co.');
				next = { status: 'lost', jobId: answer.job_id ?? current.jobId ?? null };
			} else if (answer?.status === 'failed' || answer?.status === 'revoked') {
				next = { status: 'failed', jobId: answer.job_id ?? current.jobId ?? null, code: answer.status };
			} else {
				next = later();
			}
		} catch (error) {
			if (isCredentialRevoked(error)) {
				this.signals.revoked$.next();
				return true;
			}
			if (error instanceof ProblemError && error.status === 404) {
				next = { status: 'failed', jobId: current.jobId ?? null, code: 'not_found' };
			} else {
				if (!isUnreachable(error) && !(error instanceof ProblemError && error.status === 403)) {
					this.logger.warn(`The Sign in with Ever ID client could not be read (${errorCode(error)}).`);
				}
				next = later();
			}
		}
		const written = await this.write(blob, next, next.status !== 'pending');
		if (written && next.status === 'ready') {
			for (const listener of this.readyListeners) {
				await listener().catch((error) =>
					this.logger.warn(`A step after the Sign in with Ever ID client became ready failed (${errorCode(error)}).`)
				);
			}
		}
		return true;
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	/** Whether and how Sign in with Ever ID is configured right now (read at most every 10 seconds). */
	private async cached(): Promise<{ enabled: boolean; config: SignInClientConfig | null }> {
		if (this.cache && this.now() - this.cache.at < CONFIG_CACHE_MS) {
			return this.cache;
		}
		const row = await this.store.integration('instance', EVER_ID_LOGIN);
		const enabled = row?.enabled === true;
		const state = enabled ? this.read(row?.configEncrypted ?? null) : null;
		const config =
			state?.status === 'ready' && state.issuer && state.clientId && state.clientSecret
				? { issuer: state.issuer, clientId: state.clientId, clientSecret: state.clientSecret }
				: null;
		this.cache = { at: this.now(), enabled, config };
		return this.cache;
	}

	/** The stored state, or `null` when there is none or it cannot be read with this process's secrets. */
	private read(blob: string | null): SignInClientState | null {
		const plain = this.secrets.open(blob, 'integration_config');
		if (!plain) {
			return null;
		}
		try {
			const state = JSON.parse(plain) as SignInClientState;
			return state && typeof state.status === 'string' ? state : null;
		} catch {
			return null;
		}
	}

	/** Stores `next` over `expected` (compare and set); audits a change of status. */
	private async write(expected: string | null, next: SignInClientState, audit = true): Promise<boolean> {
		const written = await this.store.setIntegrationConfig(
			'instance',
			EVER_ID_LOGIN,
			this.secrets.seal(JSON.stringify(next), 'integration_config'),
			expected
		);
		this.cache = null;
		if (written && audit) {
			await this.audit.record({
				action: 'sign_in_client.change',
				actorLabel: 'platform',
				integration: EVER_ID_LOGIN,
				details: { state: next.status, ...(next.jobId ? { job_id: next.jobId } : {}), ...(next.code ? { reason: next.code } : {}) }
			});
		}
		return written;
	}
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
