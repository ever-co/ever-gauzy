import {
	ConflictException,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit,
	Optional,
	UnprocessableEntityException
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Subscription } from 'rxjs';
import {
	connectKeyMaterialProblem,
	EverConnectKeyMaterialError,
	EverInstanceService
} from '@gauzy/plugin-ever-instance';
import { ActorLabel, EverConnectAuditService } from './ever-connect-audit.service';
import type { EverConnectConfig } from './ever-connect-config';
import {
	CONNECT_CODE_SHAPE,
	ConnectionStatus,
	DISCONNECT_TIMEOUT_MS,
	ENV_CODE_RETRY_MS,
	EVER_CONNECT_CLOCK,
	EVER_CONNECT_ENV,
	EVER_CONNECT_SETTINGS,
	PRODUCT
} from './ever-connect.constants';
import { EverConnectEntitlementService } from './ever-connect-entitlement.service';
import { EverConnectIntegrationStateService } from './ever-connect-integration-state.service';
import { EverConnectLinkService, LinkView } from './ever-connect-link.service';
import {
	EverConnectPlatformService,
	errorCode,
	isCredentialRevoked,
	isUnreachable,
	PlatformUnavailableError
} from './ever-connect-platform.service';
import { EverConnectSignals } from './ever-connect-signals';
import { ConnectionRecord, EverConnectStore } from './ever-connect.store';
import { EntitlementError, KeyManifestError, ProblemError } from './sdk';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** Who connects, and the organization to link along (optional). */
export interface ConnectInput {
	code: string;
	actorLabel: ActorLabel;
	userId: string | null;
	/** The operator's tenant and organization, linked at once when the code names an organization. */
	tenant?: { tenantId: string; organizationId: string; displayName?: string | null } | null;
}

export interface ConnectResult {
	status: ConnectionStatus;
	kid: string | null;
	link: LinkView | null;
}

/** The connection summary of `GET /ever-connect/status` (no secret, no token, no key). */
export interface ConnectionSummary {
	status: ConnectionStatus;
	platform_instance_id: string | null;
	kid: string | null;
	owner_handle: string | null;
	connected_at: string | null;
	last_heartbeat_at: string | null;
	feed_mode: string;
	last_error: string | null;
	api_url: string | null;
	return_url: string | null;
	key_material: 'ok' | 'no_secret' | 'jwt_secret_default' | 'encryption_key_default';
	env_code: 'none' | 'pending' | 'used';
}

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

/**
 * Connect (a connect code from app.ever.co, pasted by the operator or set once in
 * `EVER_CONNECT_CODE`), disconnect, and what follows a revocation by Ever Platform.
 *
 * Connect checks everything it can before any call: the address, the key material (refused without
 * `ENCRYPTION_KEY` or a non-default `JWT_SECRET`), the code's shape, an existing connection. The
 * redeem carries the product, its version, the declared install source, the kind, the connect key's
 * public part, and optionally the organization to link; never an address of the installation (only
 * the web app's origin for the consent return, of which Ever Platform keeps a digest). The
 * entitlement document is verified before anything is stored: when it does not verify, nothing is.
 */
@Injectable()
export class EverConnectConnectionService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('EverConnect');
	private readonly env: Record<string, string | undefined>;
	private readonly now: () => number;
	private envCodeTimer: NodeJS.Timeout | null = null;
	private subscription: Subscription | null = null;

	constructor(
		private readonly platform: EverConnectPlatformService,
		private readonly store: EverConnectStore,
		private readonly audit: EverConnectAuditService,
		private readonly entitlements: EverConnectEntitlementService,
		private readonly states: EverConnectIntegrationStateService,
		private readonly links: EverConnectLinkService,
		private readonly signals: EverConnectSignals,
		private readonly instance: EverInstanceService,
		@Inject(EVER_CONNECT_SETTINGS) private readonly config: EverConnectConfig,
		@Optional() @Inject(EVER_CONNECT_ENV) env?: Record<string, string | undefined>,
		@Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }
	) {
		this.env = env ?? process.env;
		this.now = clock?.now ?? (() => Date.now());
	}

	onModuleInit(): void {
		this.subscription = this.signals.revoked$.subscribe(() => {
			this.stopLocally('revoked').catch((error) =>
				this.logger.warn(`The revocation could not be applied (${errorCode(error)}).`)
			);
		});
	}

	onModuleDestroy(): void {
		this.subscription?.unsubscribe();
		if (this.envCodeTimer) clearTimeout(this.envCodeTimer);
		this.envCodeTimer = null;
	}

	/** The connection row as it is now. */
	async connection(): Promise<ConnectionRecord> {
		return this.store.connection();
	}

	async summary(): Promise<ConnectionSummary> {
		const c = await this.store.connection();
		const code = this.config.connectCode;
		return {
			status: c.status,
			platform_instance_id: c.platformInstanceId,
			kid: c.kid,
			owner_handle: c.ownerHandle,
			connected_at: iso(c.connectedAt),
			last_heartbeat_at: iso(c.lastHeartbeatAt),
			feed_mode: this.config.feedMode,
			last_error: c.lastError,
			api_url: this.config.apiUrl,
			return_url: this.config.returnUrl,
			key_material: connectKeyMaterialProblem(this.env) ?? 'ok',
			env_code: !code ? 'none' : c.envCodeConsumedHash === sha256(code.trim().toUpperCase()) ? 'used' : 'pending'
		};
	}

	/**
	 * At start: with a connection, picks it up (client, timers); without one and with
	 * `EVER_CONNECT_CODE`, uses that code once. Nothing at all is sent otherwise.
	 */
	async start(): Promise<void> {
		const connection = await this.store.connection();
		if (connection.status === 'connected' || connection.status === 'pending_approval') {
			this.platform.setRegistryInstanceId(connection.platformInstanceId);
			if (connection.status === 'connected') {
				this.signals.connected$.next();
			}
			return;
		}
		await this.useEnvCode();
	}

	// ── Connect ───────────────────────────────────────────────────────────────

	async connect(input: ConnectInput): Promise<ConnectResult> {
		if (!this.config.apiUrl) {
			throw new UnprocessableEntityException({
				statusCode: 422,
				code: 'platform_url_unusable',
				message: 'EVER_PLATFORM_API_URL cannot be used; nothing was sent.'
			});
		}
		const material = connectKeyMaterialProblem(this.env);
		if (material) {
			throw new UnprocessableEntityException({
				statusCode: 422,
				code: 'key_material_missing',
				reason: material,
				message:
					'Set ENCRYPTION_KEY (or a strong, unique JWT_SECRET) on the API before connecting this installation; nothing was sent.'
			});
		}
		const code = String(input.code ?? '')
			.trim()
			.toUpperCase();
		if (!CONNECT_CODE_SHAPE.test(code)) {
			throw new UnprocessableEntityException({
				statusCode: 422,
				code: 'code_invalid',
				message: 'This is not a connect code (EVC-XXXX-XXXX-XXXX).'
			});
		}
		const before = await this.store.connection();
		if (before.status === 'connected' || before.status === 'pending_approval') {
			throw new ConflictException({
				statusCode: 409,
				code: 'already_connected',
				message: 'This installation is already connected. Disconnect it first.'
			});
		}
		let key;
		try {
			key = await this.instance.ensureConnectKey();
		} catch (error) {
			if (error instanceof EverConnectKeyMaterialError) {
				throw new UnprocessableEntityException({
					statusCode: 422,
					code: 'key_material_missing',
					reason: error.code,
					message: error.message
				});
			}
			throw error;
		}
		this.platform.setRegistryInstanceId(null);
		const client = await this.platform.getClient();
		// Ever Platform's keys first: a platform whose documents this installation cannot verify is
		// refused before the code is used.
		try {
			await this.platform.keys({ refresh: true });
		} catch (error) {
			throw this.problem(error, 'keys');
		}
		const identity = await this.instance.ensure();
		const tenant = input.tenant
			? {
					product_tenant_id: input.tenant.tenantId,
					product_org_id: input.tenant.organizationId,
					...(input.tenant.displayName ? { display_name: input.tenant.displayName.slice(0, 120) } : {})
				}
			: null;
		const body = {
			code,
			product: PRODUCT,
			version: this.config.version,
			install_source: this.config.installSource,
			kind: this.config.cloud ? ('cloud' as const) : ('self_hosted' as const),
			public_jwk: { kty: 'OKP', crv: 'Ed25519', x: key.publicKey },
			...(this.config.serves.includes('teams') ? { serves_products: ['teams'] } : {}),
			...(this.config.returnOrigin ? { return_origins: [this.config.returnOrigin] } : {}),
			...(tenant ? { tenant } : {})
		};
		let redeemed: {
			instance_id: string;
			kid: string;
			status: string;
			link?: { id: string; org_id: string } | null;
		};
		try {
			redeemed = (await client.connect.redeem(
				body as never,
				sha256(`${identity.instanceId}|${code}`)
			)) as typeof redeemed;
		} catch (error) {
			throw this.problem(error, 'redeem');
		}
		const status: ConnectionStatus = redeemed.status === 'pending_approval' ? 'pending_approval' : 'connected';
		this.platform.setRegistryInstanceId(redeemed.instance_id);
		await this.store.updateConnection({
			platformInstanceId: redeemed.instance_id,
			kid: redeemed.kid,
			apiUrl: this.config.apiUrl,
			status,
			connectedAt: this.now(),
			connectedByUserId: input.userId,
			ownerOrgId: redeemed.link?.org_id ?? null,
			ownerHandle: null,
			lastError: null,
			revokedAt: null,
			feedCursor: null,
			nextHeartbeatAt: null
		});
		if (status === 'pending_approval') {
			await this.audit.record({
				action: 'instance.connect',
				actorLabel: input.actorLabel,
				actorUserId: input.userId,
				details: { platform_instance_id: redeemed.instance_id, kid: redeemed.kid, status }
			});
			return { status, kid: redeemed.kid, link: null };
		}
		const link = await this.completeConnect(redeemed.instance_id, input, redeemed.link ?? null);
		await this.audit.record({
			action: 'instance.connect',
			actorLabel: input.actorLabel,
			actorUserId: input.userId,
			details: { platform_instance_id: redeemed.instance_id, kid: redeemed.kid, status }
		});
		this.signals.connected$.next();
		return { status, kid: redeemed.kid, link };
	}

	/**
	 * After the redeem (or Ever Platform's approval of a pending connection): verifies and stores the
	 * entitlement documents, stores the link the redeem made, and reads the integration states. When
	 * the installation's document does not verify, nothing is kept: the connection is undone here and
	 * on Ever Platform (best effort), and 422 `entitlement_unverifiable` answers.
	 */
	private async completeConnect(
		registryId: string,
		input: Pick<ConnectInput, 'tenant' | 'userId'>,
		redeemedLink: { id: string; org_id: string } | null
	): Promise<LinkView | null> {
		try {
			const verified = await this.entitlements.fetchInstanceDocument(registryId);
			await this.entitlements.storeInstanceDocument(verified);
		} catch (error) {
			await this.undoConnect();
			if (error instanceof EntitlementError || error instanceof KeyManifestError) {
				throw new UnprocessableEntityException({
					statusCode: 422,
					code: 'entitlement_unverifiable',
					reason: error.code,
					...(error instanceof EntitlementError && error.path ? { field: error.path } : {}),
					message:
						"Ever Platform's entitlement document could not be verified; the installation was not connected."
				});
			}
			throw this.problem(error, 'entitlement');
		}
		let link: LinkView | null = null;
		if (redeemedLink && input.tenant) {
			try {
				link = await this.links.storeFromRedeem(
					{ ...input.tenant, userId: input.userId ?? null },
					redeemedLink.org_id,
					redeemedLink.id
				);
			} catch (error) {
				this.logger.warn(
					`The organization linked by the connect code could not be stored (${errorCode(error)}); link it with a link code.`
				);
			}
		}
		await this.states
			.sync('operator')
			.catch((error) => this.logger.warn(`Integration states could not be read now (${errorCode(error)}).`));
		return link;
	}

	/** Undoes a connect whose document did not verify: nothing is kept here, Ever Platform is told (best effort). */
	private async undoConnect(): Promise<void> {
		try {
			const client = await this.platform.getClient();
			await client.instances.disconnect(sha256(`undo|${this.platform.registryInstanceId}`));
		} catch {
			// Best effort: the code is used either way.
		}
		this.platform.reset();
		await this.store.updateConnection({
			status: 'disconnected',
			platformInstanceId: null,
			kid: null,
			connectedAt: null,
			connectedByUserId: null,
			ownerOrgId: null,
			ownerHandle: null,
			instanceEntitlementJwsEncrypted: null,
			instanceEntitlementSeq: null,
			instanceEntitlementIat: null,
			instanceEntitlementExp: null,
			instanceEntitlementFetchedAt: null,
			lastError: 'entitlement_unverifiable'
		});
	}

	/** Ever Platform approved a connection that was pending: finish it. */
	async approved(): Promise<void> {
		const connection = await this.store.connection();
		if (connection.status !== 'pending_approval' || !connection.platformInstanceId) return;
		await this.store.updateConnection({ status: 'connected' });
		try {
			await this.completeConnect(connection.platformInstanceId, { tenant: null, userId: null }, null);
			this.signals.connected$.next();
		} catch (error) {
			this.logger.warn(`The approved connection could not be completed (${errorCode(error)}).`);
		}
	}

	/** Re-reads a pending connection's state (`GET /v1/instances/me`), for the Connection tab. */
	async checkApproval(): Promise<ConnectionStatus> {
		const connection = await this.store.connection();
		if (connection.status !== 'pending_approval') return connection.status;
		try {
			const self = (await (await this.platform.getClient()).instances.self()) as {
				instance?: { status?: string };
			};
			if (self.instance?.status === 'active') {
				await this.approved();
			}
		} catch (error) {
			if (isCredentialRevoked(error)) await this.stopLocally('revoked');
		}
		return (await this.store.connection()).status;
	}

	// ── EVER_CONNECT_CODE ─────────────────────────────────────────────────────

	/**
	 * Uses `EVER_CONNECT_CODE` once: only without a connection, only when that code was not used
	 * before (its hash is kept), and one process at a time. Any answer of Ever Platform uses the code
	 * up; only a network failure is retried (1 min, 5 min, 30 min, 2 h, 6 h, then every 24 h).
	 */
	async useEnvCode(): Promise<void> {
		const raw = this.config.connectCode;
		if (!raw) return;
		const code = raw.trim().toUpperCase();
		const hash = sha256(code);
		const connection = await this.store.connection();
		if (
			connection.status === 'connected' ||
			connection.status === 'pending_approval' ||
			connection.envCodeConsumedHash === hash
		) {
			return;
		}
		const now = this.now();
		if (connection.envCodeNextAttemptAt !== null && connection.envCodeNextAttemptAt > now) {
			this.scheduleEnvCode(connection.envCodeNextAttemptAt - now);
			return;
		}
		const wait = ENV_CODE_RETRY_MS[Math.min(connection.envCodeAttempts, ENV_CODE_RETRY_MS.length - 1)];
		if (!(await this.store.claimEnvCodeAttempt(connection.envCodeNextAttemptAt, now + wait))) {
			return;
		}
		try {
			await this.connect({ code, actorLabel: 'env:EVER_CONNECT_CODE', userId: null, tenant: null });
			await this.store.updateConnection({
				envCodeConsumedHash: hash,
				envCodeAttempts: 0,
				envCodeNextAttemptAt: null
			});
			this.logger.log('EVER_CONNECT_CODE was used: this installation is connected to Ever Platform.');
		} catch (error) {
			const status = error instanceof HttpException ? error.getStatus() : 0;
			const body = error instanceof HttpException ? (error.getResponse() as { code?: string }) : {};
			// Refused here before the code was sent: it is not used up.
			const local = ['platform_url_unusable', 'key_material_missing', 'keys_unverifiable'].includes(
				String(body?.code)
			);
			if (status === HttpStatus.BAD_GATEWAY || local) {
				await this.store.updateConnection({
					envCodeAttempts: connection.envCodeAttempts + 1,
					lastError: String(body?.code ?? 'platform_unreachable')
				});
				this.scheduleEnvCode(wait);
				this.logger.warn(
					`EVER_CONNECT_CODE could not be used now (${body?.code ?? 'error'}); it is tried again later.`
				);
			} else {
				// Ever Platform answered: the code is used up, whatever the answer.
				await this.store.updateConnection({
					envCodeConsumedHash: hash,
					envCodeNextAttemptAt: null,
					lastError: String(body?.code ?? errorCode(error))
				});
				this.logger.warn(
					`EVER_CONNECT_CODE was refused (${body?.code ?? errorCode(error)}); it is not used again.`
				);
			}
		}
	}

	private scheduleEnvCode(delayMs: number): void {
		if (this.envCodeTimer) clearTimeout(this.envCodeTimer);
		this.envCodeTimer = setTimeout(
			() => {
				this.envCodeTimer = null;
				this.useEnvCode().catch((error) => this.logger.warn(`EVER_CONNECT_CODE: ${errorCode(error)}`));
			},
			Math.max(1_000, delayMs)
		);
		this.envCodeTimer.unref?.();
	}

	// ── Disconnect, revocation ────────────────────────────────────────────────

	/**
	 * Disconnects: Ever Platform is told (best effort, at most 10 seconds), then, whatever it
	 * answered, the connection is `disconnected` here, the documents are deleted, every integration
	 * is off, the links are archived and the heartbeat and feed stop. The anonymous statistics are
	 * not touched.
	 */
	async disconnect(actor: { actorLabel: ActorLabel; userId: string | null }): Promise<void> {
		const connection = await this.store.connection();
		if (connection.status === 'disconnected') {
			return;
		}
		let remote = false;
		if (connection.status === 'connected' || connection.status === 'pending_approval') {
			try {
				const client = await this.platform.getClient();
				await Promise.race([
					client.instances.disconnect(
						sha256(`disconnect|${connection.platformInstanceId}|${connection.connectedAt}`)
					),
					new Promise((_, reject) =>
						setTimeout(
							() => reject(new PlatformUnavailableError('platform_unreachable')),
							DISCONNECT_TIMEOUT_MS
						).unref?.()
					)
				]);
				remote = true;
			} catch (error) {
				this.logger.warn(
					`Ever Platform was not told about the disconnect (${errorCode(error)}); this installation is disconnected anyway.`
				);
			}
		}
		await this.stopLocally('disconnected', actor, remote);
	}

	/**
	 * The local steps of a disconnect, and of a revocation (`401 credential_revoked`, or the feed's
	 * `instance.revoked`): status, documents, integrations, links, timers. A revoked connect key is
	 * dropped (Ever Platform never accepts it again; the next connect makes a new one).
	 */
	async stopLocally(
		status: 'disconnected' | 'revoked',
		actor: { actorLabel: ActorLabel; userId: string | null } = { actorLabel: 'platform', userId: null },
		remote = false
	): Promise<void> {
		const connection = await this.store.connection();
		if (connection.status === status || (connection.status === 'disconnected' && status === 'revoked')) {
			return;
		}
		this.signals.stopped$.next();
		this.platform.reset();
		await this.store.updateConnection({
			status,
			revokedAt: status === 'revoked' ? this.now() : null,
			instanceEntitlementJwsEncrypted: null,
			instanceEntitlementSeq: null,
			instanceEntitlementIat: null,
			instanceEntitlementExp: null,
			instanceEntitlementFetchedAt: null,
			feedCursor: null,
			leasedBy: null,
			leaseUntil: null,
			nextHeartbeatAt: null,
			lastError: status === 'revoked' ? 'credential_revoked' : null
		});
		await this.states.allOffLocally('instance');
		for (const link of await this.store.liveLinks()) {
			await this.links.unlinkLocally(
				link,
				actor.actorLabel === 'user' ? 'user' : actor.actorLabel === 'operator' ? 'operator' : 'system',
				actor.userId,
				remote
			);
		}
		if (status === 'revoked') {
			await this.instance.dropConnectKey();
		}
		await this.audit.record({
			action: 'instance.disconnect',
			actorLabel: actor.actorLabel,
			actorUserId: actor.userId,
			details: { platform_instance_id: connection.platformInstanceId, status, remote }
		});
	}

	/** An HTTP answer for a failed platform step: never the platform's text, its code only. */
	private problem(error: unknown, step: 'keys' | 'redeem' | 'entitlement'): Error {
		if (isCredentialRevoked(error)) {
			this.signals.revoked$.next();
		}
		if (error instanceof PlatformUnavailableError && error.code === 'keys_unverifiable') {
			return new UnprocessableEntityException({
				statusCode: 422,
				code: 'keys_unverifiable',
				message: "Ever Platform's keys could not be verified for this address; nothing was sent."
			});
		}
		if (error instanceof KeyManifestError) {
			return new UnprocessableEntityException({
				statusCode: 422,
				code: 'keys_unverifiable',
				reason: error.code,
				message: "Ever Platform's keys could not be verified for this address; nothing was sent."
			});
		}
		if (isUnreachable(error)) {
			return new HttpException(
				{ statusCode: 502, code: 'platform_unreachable', message: 'Ever Platform could not be reached.' },
				HttpStatus.BAD_GATEWAY
			);
		}
		if (error instanceof ProblemError) {
			const status = [404, 409, 422].includes(error.status) ? error.status : 422;
			return new HttpException(
				{
					statusCode: status,
					code: error.code,
					message:
						step === 'redeem'
							? 'Ever Platform refused the connect code.'
							: 'Ever Platform refused the request.'
				},
				status
			);
		}
		return error as Error;
	}
}
