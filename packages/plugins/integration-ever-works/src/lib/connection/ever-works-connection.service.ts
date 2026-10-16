import {
	BadGatewayException,
	BadRequestException,
	ConflictException,
	HttpException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { IntegrationSetting, IntegrationTenant, Tenant } from '@gauzy/core';
import { EverWorksApiError, EverWorksClient, EverWorksNetworkError, EverWorksUrlError, normaliseApiBaseUrl } from '../client/ever-works-client';
import { EverWorksClientFactory } from '../client/ever-works-client.factory';
import {
	EVER_GAUZY_PRESET_SCOPES,
	EVER_WORKS_REQUIRED_SCOPES,
	EverWorksWebhookSubscription,
	EverWorksWhoami
} from '../client/ever-works-client.types';
import { EverWorksConfig } from '../ever-works-config';
import { EVER_WORKS_CONTRACT_VERSION, EVER_WORKS_INTEGRATION_NAME, EVER_WORKS_ROUTE_PREFIX } from '../ever-works.constants';
import { EVER_WORKS_CONFIG } from '../ever-works.tokens';
import { EverWorksSettingName } from '../ever-works-setting.enum';
import { EverWorksScope, EverWorksScopeService } from '../ever-works-scope.service';
import { EverWorksConnectDto, EverWorksKeyDto } from './dto/ever-works-connection.dto';
import { EverWorksAuthMode, EverWorksConnection, EverWorksConnectionStatus } from './ever-works-connection.entity';
import { EverWorksNotifier } from './ever-works-notifier.service';
import { EverWorksSecretBox, EverWorksSecretError } from './ever-works-secret-box';

/** The events the Gauzy webhook subscribes to: every P1–P3 domain (catalog wildcards, B.4). */
export const EVER_WORKS_WEBHOOK_EVENTS = [
	'organization.*',
	'agent.*',
	'team.*',
	'work.*',
	'mission.*',
	'goal.*',
	'idea.*',
	'task.*',
	'inbox.*',
	'kb.*'
];

/** A pinned Ever Works organization (from `whoami`). */
export interface EverWorksPinnedOrganization {
	id: string;
	slug: string;
	displayName: string;
}

/** What a key is, as `whoami` describes it (`POST …/connections/validate`). Carries no secret. */
export interface EverWorksKeyValidation {
	apiBaseUrl: string;
	keyId: string;
	keyName: string;
	keyPrefix: string;
	tenant: { id: string; slug: string };
	organizations: EverWorksPinnedOrganization[];
	scopes: string[];
	/** Scopes of the "Ever Gauzy" preset the key lacks: the matching data does not sync. */
	missingScopes: string[];
	/** Scopes the connection cannot work without (the change feed, the webhook). */
	missingRequiredScopes: string[];
	apiVersion: string;
	compatible: boolean;
	feedHead: string;
	limits: { readsPerMin: number; writesPerMin: number };
}

/** A connection as the API returns it. Never the key or the webhook secret. */
export interface EverWorksConnectionView {
	id: ID;
	organizationId: ID | null;
	status: EverWorksConnectionStatus;
	authMode: EverWorksAuthMode;
	apiBaseUrl: string;
	ewTenant: { id: string; slug: string | null };
	key: { id: string | null; name: string | null; prefix: string | null };
	scopes: string[];
	missingScopes: string[];
	pinnedOrganizations: EverWorksPinnedOrganization[];
	apiVersion: string | null;
	webhook: { registered: boolean; subscriptionId: string | null; url: string | null };
	feedCursor: string | null;
	lastError: string | null;
	lastErrorAt: Date | null;
	lastHealthyAt: Date | null;
	lastCheckedAt: Date | null;
	connectedByUserId: ID | null;
	createdAt: Date | null;
}

/** The outcome of a health check. */
export interface EverWorksHealthResult {
	status: EverWorksConnectionStatus;
	healthy: boolean;
	lastError: string | null;
}

/**
 * The connection to Ever Works (plan 02 §1 and §4, G-P1-3): validate a key with `whoami`, connect,
 * rotate the key, pause, resume, check health, register the webhook subscription and disconnect.
 *
 * - The key is validated against Ever Works before anything is stored, and stored only encrypted
 *   (`EverWorksSecretBox`); nothing is stored when the encryption key material is unusable.
 * - One active connection per tenant, serialised per tenant (Postgres advisory lock, MySQL row lock,
 *   SQLite's single writer).
 * - A 401 from Ever Works marks the connection `needs_reauth`, pauses it and notifies the admin who
 *   connected (an employee notification until the Inbox exists).
 * - Disconnect archives the connection and the organization mappings, keeps links and logs, and
 *   deletes the Ever Works webhook subscription on a best-effort basis. Nothing synced is deleted.
 */
@Injectable()
export class EverWorksConnectionService {
	private readonly logger = new Logger('EverWorksConnection');
	private readonly secretBox: EverWorksSecretBox;
	private readonly webhookRegistrations = new Map<string, Promise<EverWorksConnectionView>>();

	constructor(
		private readonly dataSource: DataSource,
		private readonly clients: EverWorksClientFactory,
		private readonly scopes: EverWorksScopeService,
		private readonly notifier: EverWorksNotifier,
		@Inject(EVER_WORKS_CONFIG) private readonly config: EverWorksConfig
	) {
		this.secretBox = new EverWorksSecretBox(process.env);
	}

	// ── Routes ─────────────────────────────────────────────────────────────────────────────────

	/** `POST /connections/validate`: what the key is, without storing anything. */
	async validate(dto: EverWorksConnectDto, organizationId?: ID): Promise<EverWorksKeyValidation> {
		await this.scopes.resolve(organizationId);
		const apiBaseUrl = this.apiBaseUrl(dto.apiBaseUrl);
		const whoami = await this.call(() => this.clients.create({ apiBaseUrl, apiKey: dto.apiKey }).whoami());
		return this.describe(apiBaseUrl, dto.apiKey, whoami);
	}

	/** `POST /connections`: validates the key and connects this tenant (or resumes its earlier connection to the same Ever Works tenant). */
	async connect(dto: EverWorksConnectDto, organizationId?: ID): Promise<EverWorksConnectionView> {
		const scope = await this.scopes.resolve(organizationId);
		this.assertSecretsUsable();
		const apiBaseUrl = this.apiBaseUrl(dto.apiBaseUrl);
		const whoami = await this.call(() => this.clients.create({ apiBaseUrl, apiKey: dto.apiKey }).whoami());
		const validation = this.describe(apiBaseUrl, dto.apiKey, whoami);
		if (!validation.compatible) {
			throw new BadRequestException(
				`This Ever Works speaks integration API v${validation.apiVersion}; Gauzy speaks v${EVER_WORKS_CONTRACT_VERSION}.`
			);
		}
		// A subscription the disconnect could not delete (Ever Works was unreachable then): deleted once this commits.
		const orphan: { subscriptionId: string | null; apiKeyEncrypted: string | null } = { subscriptionId: null, apiKeyEncrypted: null };
		const saved = await this.transaction(scope.tenantId, async (manager) => {
			const active = await manager.findOne(EverWorksConnection, {
				where: { tenantId: scope.tenantId, isActive: true }
			});
			if (active) {
				throw new ConflictException(
					'This tenant is already connected to Ever Works. Update its key or disconnect it first.'
				);
			}
			// A reconnect to the same Ever Works tenant resumes the earlier connection (same id), so its
			// links and logs apply again and nothing is duplicated (plan 02 §1, Disconnect).
			const previous = await manager.findOne(EverWorksConnection, {
				where: { tenantId: scope.tenantId, ewTenantId: whoami.tenant.id, isActive: false },
				order: { updatedAt: 'DESC' }
			});
			const connection = previous ?? manager.create(EverWorksConnection, { id: randomUUID(), tenantId: scope.tenantId });
			const id = connection.id as ID;
			if (previous?.webhookSubscriptionId) {
				Object.assign(orphan, { subscriptionId: previous.webhookSubscriptionId, apiKeyEncrypted: previous.apiKeyEncrypted ?? null });
			}
			Object.assign(connection, {
				organizationId: scope.organizationId,
				authMode: EverWorksAuthMode.API_KEY,
				status: EverWorksConnectionStatus.ACTIVE,
				apiBaseUrl,
				ewTenantId: whoami.tenant.id,
				ewTenantSlug: whoami.tenant.slug ?? null,
				keyId: whoami.keyId ?? null,
				keyName: whoami.keyName ?? null,
				keyPrefix: validation.keyPrefix,
				apiKeyEncrypted: this.secretBox.seal(dto.apiKey, 'api_key', id),
				scopes: JSON.stringify(validation.scopes),
				pinnedOrganizations: JSON.stringify(validation.organizations),
				apiVersion: whoami.apiVersion,
				// Follow the change feed from now (a resumed connection keeps its cursor); history is the initial sync's job.
				feedCursor: previous?.feedCursor ?? String(whoami.feedHead ?? '0'),
				lastError: null,
				lastErrorAt: null,
				lastHealthyAt: new Date(),
				lastCheckedAt: new Date(),
				connectedByUserId: scope.userId,
				disconnectedAt: null,
				isActive: true,
				isArchived: false,
				archivedAt: null
			});
			// The webhook of an earlier connection was deleted at disconnect, is gone with its key, or is
			// deleted below; its signing secret is gone either way, so it is not this connection's webhook.
			if (previous) {
				Object.assign(connection, { webhookSubscriptionId: null, webhookSecretEncrypted: null, webhookUrl: null });
			}
			return manager.save(EverWorksConnection, connection);
		});
		this.logger.log(`Tenant ${scope.tenantId} connected to Ever Works tenant ${whoami.tenant.id} (connection ${saved.id}).`);
		if (orphan.subscriptionId) {
			// It still delivers to this connection's URL (the id is reused) and every delivery would be refused.
			// A subscription belongs to the key that made it: the new key first, then the earlier one.
			const earlier = orphan.apiKeyEncrypted;
			await this.deleteUnusedWebhook(
				orphan.subscriptionId,
				[() => this.client(saved), ...(earlier ? [() => this.client({ ...saved, apiKeyEncrypted: earlier } as EverWorksConnection)] : [])],
				'Reconnect'
			);
		}
		return this.view(saved);
	}

	/** `GET /connections`: this tenant's active connection, or `null`. */
	async current(organizationId?: ID): Promise<EverWorksConnectionView | null> {
		const scope = await this.scopes.resolve(organizationId);
		const connection = await this.dataSource.getRepository(EverWorksConnection).findOne({
			where: { tenantId: scope.tenantId, isActive: true }
		});
		return connection ? this.view(connection) : null;
	}

	/** `GET /connections/:id`. */
	async get(id: ID, organizationId?: ID): Promise<EverWorksConnectionView> {
		return this.view(await this.require(id, await this.scopes.resolve(organizationId)));
	}

	/** `PUT /connections/:id/key`: swaps in a new key of the SAME Ever Works tenant (rotation, or after `needs_reauth`). */
	async rotateKey(id: ID, dto: EverWorksKeyDto, organizationId?: ID): Promise<EverWorksConnectionView> {
		const scope = await this.scopes.resolve(organizationId);
		this.assertSecretsUsable();
		const existing = await this.require(id, scope);
		const whoami = await this.call(() => this.clients.create({ apiBaseUrl: existing.apiBaseUrl, apiKey: dto.apiKey }).whoami());
		const validation = this.describe(existing.apiBaseUrl, dto.apiKey, whoami);
		if (whoami.tenant.id !== existing.ewTenantId) {
			throw new BadRequestException('The new key belongs to another Ever Works tenant. Disconnect and connect again instead.');
		}
		if (!validation.compatible) {
			throw new BadRequestException(`The Ever Works API version changed to v${validation.apiVersion}; Gauzy speaks v${EVER_WORKS_CONTRACT_VERSION}.`);
		}
		// A webhook subscription belongs to the key that made it: under another key it can no longer be
		// managed, and it stops when the old key is revoked. It moves to the new key below.
		const moved: { subscriptionId: string | null; apiKeyEncrypted: string | null } = { subscriptionId: null, apiKeyEncrypted: null };
		const saved = await this.mutate(existing.id as ID, scope.tenantId, (connection) => {
			const wasPausedByAdmin = connection.status === EverWorksConnectionStatus.PAUSED;
			const sameKey = !!whoami.keyId && whoami.keyId === connection.keyId;
			if (!sameKey && connection.webhookSubscriptionId) {
				Object.assign(moved, { subscriptionId: connection.webhookSubscriptionId, apiKeyEncrypted: connection.apiKeyEncrypted ?? null });
				Object.assign(connection, { webhookSubscriptionId: null, webhookSecretEncrypted: null, webhookUrl: null });
			}
			Object.assign(connection, {
				apiKeyEncrypted: this.secretBox.seal(dto.apiKey, 'api_key', connection.id as ID),
				keyId: whoami.keyId ?? null,
				keyName: whoami.keyName ?? null,
				keyPrefix: validation.keyPrefix,
				scopes: JSON.stringify(validation.scopes),
				pinnedOrganizations: JSON.stringify(validation.organizations),
				apiVersion: whoami.apiVersion,
				status: wasPausedByAdmin ? EverWorksConnectionStatus.PAUSED : EverWorksConnectionStatus.ACTIVE,
				lastError: null,
				lastErrorAt: null,
				lastHealthyAt: new Date(),
				lastCheckedAt: new Date()
			});
		});
		if (!moved.subscriptionId) return this.view(saved);
		const earlier = moved.apiKeyEncrypted;
		await this.deleteUnusedWebhook(
			moved.subscriptionId,
			[...(earlier ? [() => this.client({ ...saved, apiKeyEncrypted: earlier } as EverWorksConnection)] : []), () => this.client(saved)],
			'Key rotation'
		);
		if (saved.status !== EverWorksConnectionStatus.ACTIVE) {
			this.logger.warn(`Key rotation: connection ${saved.id} is ${saved.status}; register its webhook again after resuming it.`);
			return this.view(saved);
		}
		try {
			return await this.registerWebhook(saved.id as ID, organizationId);
		} catch (error) {
			// The change feed keeps the sync going; the admin can register the webhook again from the connection.
			this.logger.warn(`Key rotation: the webhook could not be registered with the new key (${this.reason(error)}).`);
			return this.view(await this.reload(saved.id as ID));
		}
	}

	/** `POST /connections/:id/pause`: nothing is pulled or pushed until resumed. */
	async pause(id: ID, organizationId?: ID): Promise<EverWorksConnectionView> {
		const scope = await this.scopes.resolve(organizationId);
		await this.require(id, scope);
		const saved = await this.mutate(id, scope.tenantId, (connection) => {
			connection.status = EverWorksConnectionStatus.PAUSED;
		});
		await this.setWebhookStatus(saved, 'paused');
		return this.view(saved);
	}

	/** `POST /connections/:id/resume`: checks the key first; a revoked key stays `needs_reauth`. */
	async resume(id: ID, organizationId?: ID): Promise<EverWorksConnectionView> {
		const scope = await this.scopes.resolve(organizationId);
		const connection = await this.require(id, scope);
		const result = await this.checkHealth(connection, { resuming: true });
		if (!result.healthy) {
			throw new BadRequestException(
				`Ever Works did not accept the connection (${result.lastError ?? 'unknown error'}); it stays ${result.status}.`
			);
		}
		const saved = await this.reload(id);
		await this.setWebhookStatus(saved, 'active');
		return this.view(saved);
	}

	/** `POST /connections/:id/health`: runs the daily check now. */
	async health(id: ID, organizationId?: ID): Promise<EverWorksHealthResult> {
		const scope = await this.scopes.resolve(organizationId);
		return this.checkHealth(await this.require(id, scope));
	}

	/**
	 * `POST /connections/:id/webhook`: registers (or replaces) the webhook v2 subscription Ever Works
	 * delivers to: every P1–P3 domain, the pinned organizations, our own origin excluded. The signing
	 * secret (returned once) is stored encrypted; a replaced subscription is deleted afterwards.
	 */
	async registerWebhook(id: ID, organizationId?: ID): Promise<EverWorksConnectionView> {
		// One registration per connection at a time in this process; across processes the write below
		// re-checks the row and removes a subscription that lost the race.
		const previous = this.webhookRegistrations.get(id) ?? Promise.resolve();
		const current = previous.catch(() => undefined).then(() => this.registerWebhookOnce(id, organizationId));
		this.webhookRegistrations.set(id, current);
		try {
			return await current;
		} finally {
			if (this.webhookRegistrations.get(id) === current) this.webhookRegistrations.delete(id);
		}
	}

	private async registerWebhookOnce(id: ID, organizationId?: ID): Promise<EverWorksConnectionView> {
		const scope = await this.scopes.resolve(organizationId);
		this.assertSecretsUsable();
		const connection = await this.require(id, scope);
		if (connection.status !== EverWorksConnectionStatus.ACTIVE) {
			throw new BadRequestException(`The connection is ${connection.status}; resume it before registering its webhook.`);
		}
		const url = this.webhookUrl(connection.id as ID);
		const organizationIds = this.pins(connection).map((org) => org.id);
		if (!organizationIds.length) {
			throw new BadRequestException('The key is pinned to no Ever Works organization.');
		}
		const client = this.client(connection);
		const previousId = connection.webhookSubscriptionId ?? null;
		const subscription: EverWorksWebhookSubscription = await this.call(() =>
			client.createWebhook(
				{
					url,
					events: EVER_WORKS_WEBHOOK_EVENTS,
					organizationIds,
					excludeOriginTags: [`gauzy:${connection.id}`],
					description: `Ever Gauzy (connection ${connection.id})`
				},
				`gauzy:${connection.id}:webhook:${randomUUID()}`
			)
		);
		if (!subscription?.id || typeof subscription.secret !== 'string' || subscription.secret.length < 32) {
			throw new BadGatewayException('Ever Works did not return a webhook signing secret.');
		}
		const race = { lost: false };
		const saved = await this.mutate(connection.id as ID, scope.tenantId, (row) => {
			// Disconnected, paused or re-registered by someone else meanwhile: this subscription is not the one to keep.
			if (!row.isActive || row.status !== EverWorksConnectionStatus.ACTIVE || (row.webhookSubscriptionId ?? null) !== previousId) {
				race.lost = true;
				return;
			}
			Object.assign(row, {
				webhookSubscriptionId: subscription.id,
				webhookSecretEncrypted: this.secretBox.seal(subscription.secret as string, 'webhook_secret', row.id as ID),
				webhookUrl: url
			});
		});
		if (race.lost) {
			await client
				.deleteWebhook(subscription.id)
				.catch((error) => this.logger.warn(`An unused webhook subscription could not be deleted (${this.reason(error)}).`));
			throw new ConflictException('The connection changed while its webhook was being registered; nothing was kept. Try again.');
		}
		if (previousId && previousId !== subscription.id) {
			await client.deleteWebhook(previousId).catch((error) => this.logger.warn(`The replaced webhook subscription could not be deleted (${this.reason(error)}).`));
		}
		return this.view(saved);
	}

	/**
	 * `DELETE /connections/:id`: archives the connection and every organization mapping that syncs
	 * through it (`isActive=false`, `isArchived=true`, `IS_ENABLED=false`), keeps links and logs, and
	 * deletes the Ever Works webhook subscription on a best-effort basis. Synced data is never deleted.
	 */
	async disconnect(id: ID, organizationId?: ID): Promise<{ success: true; webhookDeleted: boolean }> {
		const scope = await this.scopes.resolve(organizationId);
		const connection = await this.require(id, scope);
		let webhookDeleted = !connection.webhookSubscriptionId;
		if (connection.webhookSubscriptionId) {
			try {
				await this.client(connection).deleteWebhook(connection.webhookSubscriptionId);
				webhookDeleted = true;
			} catch (error) {
				// A revoked key's subscriptions are disabled by Ever Works anyway; a 404 means it is gone.
				webhookDeleted = error instanceof EverWorksApiError && error.status === 404;
				this.logger.warn(`Disconnect: the webhook subscription could not be deleted (${this.reason(error)}).`);
			}
		}
		await this.transaction(scope.tenantId, async (manager) => {
			const row = await manager.findOneOrFail(EverWorksConnection, { where: { id, tenantId: scope.tenantId } });
			Object.assign(row, {
				status: EverWorksConnectionStatus.DISCONNECTED,
				isActive: false,
				isArchived: true,
				archivedAt: new Date(),
				disconnectedAt: new Date(),
				webhookSubscriptionId: webhookDeleted ? null : row.webhookSubscriptionId,
				webhookSecretEncrypted: null
			});
			await manager.save(EverWorksConnection, row);
			await this.archiveMappings(manager, scope.tenantId, id);
		});
		this.logger.log(`Connection ${id} of tenant ${scope.tenantId} disconnected.`);
		return { success: true, webhookDeleted };
	}

	// ── For the engine and the scheduler ─────────────────────────────────────────────────────────

	/** A client for a stored connection (decrypts the key; throws when it cannot be read). */
	client(connection: EverWorksConnection, scopeSlug?: string | null): EverWorksClient {
		let apiKey: string;
		try {
			apiKey = this.secretBox.open(connection.apiKeyEncrypted, 'api_key', connection.id as ID);
		} catch (error) {
			throw new ServiceUnavailableException(
				error instanceof EverWorksSecretError ? error.message : 'The stored Ever Works key cannot be read.'
			);
		}
		return this.clients.create({ apiBaseUrl: connection.apiBaseUrl, apiKey, connectionId: connection.id as ID, scopeSlug: scopeSlug ?? null });
	}

	/** The webhook signing secret of a connection, or `null` (none registered, or unreadable). */
	webhookSecret(connection: EverWorksConnection): string | null {
		if (!connection.webhookSecretEncrypted) return null;
		try {
			return this.secretBox.open(connection.webhookSecretEncrypted, 'webhook_secret', connection.id as ID);
		} catch {
			return null;
		}
	}

	/**
	 * The health check (`whoami`), daily from the scheduler and on demand. A 401 → `needs_reauth`, paused,
	 * the connecting admin notified once; another failure → `error` (an admin pause is kept); success → the
	 * scopes and pins are refreshed and an `error`/`needs_reauth` connection is active again.
	 */
	async checkHealth(connection: EverWorksConnection, options: { resuming?: boolean } = {}): Promise<EverWorksHealthResult> {
		const now = new Date();
		const keyAtCall = connection.apiKeyEncrypted;
		let whoami: EverWorksWhoami | null = null;
		let failure: unknown = null;
		try {
			whoami = await this.client(connection).whoami();
		} catch (error) {
			failure = error;
		}
		const out: { result?: EverWorksHealthResult; notify: boolean } = { notify: false };
		const saved = await this.mutate(connection.id as ID, connection.tenantId as ID, (row) => {
			// The result applies to the row as it is now: disconnected or given another key during the call →
			// the result is stale and is discarded (it must not undo an admin's change or judge a new key).
			if (!row.isActive || row.apiKeyEncrypted !== keyAtCall) {
				out.result = { status: row.status, healthy: false, lastError: 'superseded: the connection changed during the check' };
				return;
			}
			const keepPaused = row.status === EverWorksConnectionStatus.PAUSED && !options.resuming;
			let next: EverWorksConnectionStatus;
			let lastError: string | null = null;
			if (whoami && whoami.tenant?.id === row.ewTenantId && String(whoami.apiVersion) === EVER_WORKS_CONTRACT_VERSION) {
				next = keepPaused ? EverWorksConnectionStatus.PAUSED : EverWorksConnectionStatus.ACTIVE;
			} else if (whoami && whoami.tenant?.id !== row.ewTenantId) {
				next = EverWorksConnectionStatus.ERROR;
				lastError = 'tenant_changed: the key now answers for another Ever Works tenant';
			} else if (whoami) {
				next = EverWorksConnectionStatus.ERROR;
				lastError = `api_version: Ever Works speaks integration API v${String(whoami.apiVersion)}; Gauzy speaks v${EVER_WORKS_CONTRACT_VERSION}`;
			} else if (failure instanceof EverWorksApiError && failure.status === 401) {
				next = EverWorksConnectionStatus.NEEDS_REAUTH;
				lastError = `${failure.code}: ${failure.message}`;
			} else {
				next = keepPaused ? EverWorksConnectionStatus.PAUSED : EverWorksConnectionStatus.ERROR;
				lastError = this.reason(failure);
			}
			out.notify = next === EverWorksConnectionStatus.NEEDS_REAUTH && row.status !== EverWorksConnectionStatus.NEEDS_REAUTH;
			row.status = next;
			row.lastCheckedAt = now;
			if (lastError) {
				row.lastError = lastError.slice(0, 2000);
				row.lastErrorAt = now;
			} else {
				Object.assign(row, { lastError: null, lastErrorAt: null, lastHealthyAt: now });
			}
			if (whoami && !lastError) {
				Object.assign(row, {
					scopes: JSON.stringify(whoami.scopes ?? []),
					pinnedOrganizations: JSON.stringify(this.normalisePins(whoami)),
					apiVersion: whoami.apiVersion,
					keyId: whoami.keyId ?? row.keyId,
					keyName: whoami.keyName ?? row.keyName
				});
				this.reseal(row);
			}
			out.result = { status: next, healthy: !lastError, lastError };
		});
		if (out.notify) {
			await this.notifier
				.needsReauth(saved)
				.catch((error) => this.logger.warn(`The needs_reauth notice could not be sent (${this.reason(error)}).`));
		}
		return out.result ?? { status: saved.status, healthy: false, lastError: null };
	}

	/**
	 * Secrets stored under the `JWT_SECRET` fallback are encrypted again under `ENCRYPTION_KEY` once it is
	 * usable — at the next successful health check (daily, or `POST …/health`) — so an operator can move to
	 * `ENCRYPTION_KEY` and later retire the old `JWT_SECRET`. Runs inside the row's locked write.
	 */
	private reseal(row: EverWorksConnection): void {
		try {
			if (this.secretBox.needsReseal(row.apiKeyEncrypted)) {
				row.apiKeyEncrypted = this.secretBox.seal(this.secretBox.open(row.apiKeyEncrypted, 'api_key', row.id as ID), 'api_key', row.id as ID);
			}
			if (row.webhookSecretEncrypted && this.secretBox.needsReseal(row.webhookSecretEncrypted)) {
				row.webhookSecretEncrypted = this.secretBox.seal(
					this.secretBox.open(row.webhookSecretEncrypted, 'webhook_secret', row.id as ID),
					'webhook_secret',
					row.id as ID
				);
			}
		} catch (error) {
			this.logger.warn(`Connection ${row.id}: a stored secret could not be re-encrypted (${this.reason(error)}).`);
		}
	}

	/** Every active connection (the daily health check walks them). */
	activeConnections(): Promise<EverWorksConnection[]> {
		return this.dataSource.getRepository(EverWorksConnection).find({ where: { isActive: true } });
	}

	/** A view of a stored connection. Never the key or the webhook secret. */
	view(connection: EverWorksConnection): EverWorksConnectionView {
		const scopes = this.parse<string[]>(connection.scopes, []);
		return {
			id: connection.id as ID,
			organizationId: (connection.organizationId as ID) ?? null,
			status: connection.status,
			authMode: connection.authMode,
			apiBaseUrl: connection.apiBaseUrl,
			ewTenant: { id: connection.ewTenantId, slug: connection.ewTenantSlug ?? null },
			key: { id: connection.keyId ?? null, name: connection.keyName ?? null, prefix: connection.keyPrefix ?? null },
			scopes,
			missingScopes: EVER_GAUZY_PRESET_SCOPES.filter((scope) => !scopes.includes(scope)),
			pinnedOrganizations: this.pins(connection),
			apiVersion: connection.apiVersion ?? null,
			webhook: {
				registered: !!connection.webhookSubscriptionId && !!connection.webhookSecretEncrypted,
				subscriptionId: connection.webhookSubscriptionId ?? null,
				url: connection.webhookUrl ?? null
			},
			feedCursor: connection.feedCursor ?? null,
			lastError: connection.lastError ?? null,
			lastErrorAt: connection.lastErrorAt ?? null,
			lastHealthyAt: connection.lastHealthyAt ?? null,
			lastCheckedAt: connection.lastCheckedAt ?? null,
			connectedByUserId: (connection.connectedByUserId as ID) ?? null,
			createdAt: connection.createdAt ?? null
		};
	}

	// ── Internals ──────────────────────────────────────────────────────────────────────────────

	private assertSecretsUsable(): void {
		const problem = this.secretBox.problem();
		if (problem) throw new ServiceUnavailableException(new EverWorksSecretError(problem).message);
	}

	private apiBaseUrl(raw: string): string {
		try {
			return normaliseApiBaseUrl(raw);
		} catch (error) {
			throw new BadRequestException(error instanceof EverWorksUrlError ? error.message : 'Invalid Ever Works API URL.');
		}
	}

	/** Where Ever Works delivers this connection's webhooks (the public API address of this Gauzy). */
	webhookUrl(connectionId: ID): string {
		const base = this.config.gauzyApiUrl;
		if (!base) {
			throw new BadRequestException(
				'The webhook needs the public HTTPS address of this Gauzy API (API_BASE_URL); the change feed keeps syncing without it.'
			);
		}
		return `${base}/api${EVER_WORKS_ROUTE_PREFIX}/webhooks/${connectionId}`;
	}

	private describe(apiBaseUrl: string, apiKey: string, whoami: EverWorksWhoami): EverWorksKeyValidation {
		if (!whoami || typeof whoami !== 'object' || !whoami.tenant?.id) {
			throw new BadGatewayException('Ever Works answered whoami without a tenant.');
		}
		const scopes = Array.isArray(whoami.scopes) ? whoami.scopes.filter((s) => typeof s === 'string') : [];
		return {
			apiBaseUrl,
			keyId: whoami.keyId,
			keyName: whoami.keyName,
			keyPrefix: `${apiKey.slice(0, 11)}…`,
			tenant: { id: whoami.tenant.id, slug: whoami.tenant.slug },
			organizations: this.normalisePins(whoami),
			scopes,
			missingScopes: EVER_GAUZY_PRESET_SCOPES.filter((scope) => !scopes.includes(scope)),
			missingRequiredScopes: EVER_WORKS_REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope)),
			apiVersion: String(whoami.apiVersion ?? ''),
			compatible: String(whoami.apiVersion) === EVER_WORKS_CONTRACT_VERSION,
			feedHead: String(whoami.feedHead ?? '0'),
			limits: whoami.limits ?? { readsPerMin: 0, writesPerMin: 0 }
		};
	}

	private normalisePins(whoami: EverWorksWhoami): EverWorksPinnedOrganization[] {
		return (Array.isArray(whoami.organizations) ? whoami.organizations : [])
			.filter((org) => org && typeof org.id === 'string')
			.map((org) => ({ id: org.id, slug: String(org.slug ?? ''), displayName: String(org.displayName ?? org.slug ?? '') }));
	}

	pins(connection: EverWorksConnection): EverWorksPinnedOrganization[] {
		return this.parse<EverWorksPinnedOrganization[]>(connection.pinnedOrganizations, []);
	}

	private parse<T>(raw: string | null | undefined, fallback: T): T {
		if (!raw) return fallback;
		try {
			const value = JSON.parse(raw);
			return value ?? fallback;
		} catch {
			return fallback;
		}
	}

	private async require(id: ID, scope: Pick<EverWorksScope, 'tenantId'>): Promise<EverWorksConnection> {
		const connection = await this.dataSource.getRepository(EverWorksConnection).findOne({
			where: { id, tenantId: scope.tenantId, isActive: true }
		});
		if (!connection) throw new NotFoundException('Ever Works connection not found.');
		return connection;
	}

	/**
	 * Deletes a webhook subscription Gauzy no longer uses, best effort. A subscription belongs to the key
	 * that made it, so each key is tried in turn; a 404 means "not this key's" (or gone). Never throws.
	 */
	private async deleteUnusedWebhook(subscriptionId: string, clients: Array<() => EverWorksClient>, context: string): Promise<boolean> {
		for (const client of clients) {
			try {
				await client().deleteWebhook(subscriptionId);
				return true;
			} catch (error) {
				if (error instanceof EverWorksApiError && error.status === 404) continue;
				this.logger.warn(`${context}: the unused webhook subscription could not be deleted (${this.reason(error)}).`);
			}
		}
		return false;
	}

	private reload(id: ID): Promise<EverWorksConnection> {
		return this.dataSource.getRepository(EverWorksConnection).findOneOrFail({ where: { id } });
	}

	/** One write to one connection row, under the row lock where the database has one. */
	private async mutate(id: ID, tenantId: ID, change: (row: EverWorksConnection) => void): Promise<EverWorksConnection> {
		return this.dataSource.transaction(async (manager) => {
			const type = manager.connection.options.type;
			const row = await manager.findOne(EverWorksConnection, {
				where: { id, tenantId },
				...(type === 'postgres' || type === 'mysql' || type === 'mariadb' ? { lock: { mode: 'pessimistic_write' as const } } : {})
			});
			if (!row) throw new NotFoundException('Ever Works connection not found.');
			change(row);
			return manager.save(EverWorksConnection, row);
		});
	}

	/** A transaction serialised per tenant (connect and disconnect). */
	private async transaction<T>(tenantId: ID, work: (manager: EntityManager) => Promise<T>): Promise<T> {
		return this.dataSource.transaction(async (manager) => {
			const type = manager.connection.options.type;
			if (type === 'postgres') {
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`ever-works:connection:${tenantId}`]);
			} else if (type === 'mysql' || type === 'mariadb') {
				await manager.findOne(Tenant, { where: { id: tenantId }, lock: { mode: 'pessimistic_write' } });
			}
			return work(manager);
		});
	}

	/** Archives the organization mappings (`integration_tenant` named `Ever_Works`) of a connection. */
	private async archiveMappings(manager: EntityManager, tenantId: ID, connectionId: ID): Promise<void> {
		const mappings = await manager.find(IntegrationTenant, {
			where: { tenantId, name: EVER_WORKS_INTEGRATION_NAME, isActive: true },
			relations: { settings: true }
		});
		for (const mapping of mappings) {
			const settings = mapping.settings ?? [];
			if (!settings.some((s) => s.settingsName === EverWorksSettingName.CONNECTION_ID && s.settingsValue === connectionId)) {
				continue;
			}
			mapping.isActive = false;
			mapping.isArchived = true;
			const enabled = settings.find((s) => s.settingsName === EverWorksSettingName.IS_ENABLED);
			if (enabled) {
				enabled.settingsValue = 'false';
			} else {
				settings.push(
					manager.create(IntegrationSetting, {
						id: randomUUID(),
						tenantId: mapping.tenantId,
						organizationId: mapping.organizationId,
						settingsName: EverWorksSettingName.IS_ENABLED,
						settingsValue: 'false'
					})
				);
			}
			mapping.settings = settings;
			await manager.save(IntegrationTenant, mapping);
		}
	}

	/** Pauses or resumes the Ever Works side of the webhook; best effort (the feed covers any gap). */
	private async setWebhookStatus(connection: EverWorksConnection, status: 'active' | 'paused'): Promise<void> {
		if (!connection.webhookSubscriptionId) return;
		try {
			await this.client(connection).updateWebhook(connection.webhookSubscriptionId, { status });
		} catch (error) {
			this.logger.warn(`The webhook subscription could not be set ${status} (${this.reason(error)}).`);
		}
	}

	/** Runs a call to Ever Works and maps its failure to an answer for the admin (never a 401: that would sign Gauzy out). */
	private async call<T>(work: () => Promise<T>): Promise<T> {
		try {
			return await work();
		} catch (error) {
			throw this.toHttp(error);
		}
	}

	private toHttp(error: unknown): HttpException {
		if (error instanceof HttpException) return error;
		if (error instanceof EverWorksUrlError) return new BadRequestException(error.message);
		if (error instanceof EverWorksApiError) {
			if (error.status === 401) return new BadRequestException(`Ever Works rejected the key (${error.code}).`);
			if (error.status === 403) return new BadRequestException(`Ever Works refused the request (${error.code}): ${error.message}`);
			if (error.status === 404) return new BadRequestException('No Ever Works integration API answers at this URL (404).');
			if (error.status === 429) return new ServiceUnavailableException('Ever Works is rate limiting this key; try again shortly.');
			if (error.status >= 500) return new BadGatewayException(`Ever Works failed (${error.status}).`);
			return new BadRequestException(`Ever Works answered ${error.status} (${error.code}).`);
		}
		if (error instanceof EverWorksNetworkError) return new BadGatewayException(error.message);
		if (error instanceof EverWorksSecretError) return new ServiceUnavailableException(error.message);
		this.logger.warn(`Unexpected failure calling Ever Works (${this.reason(error)}).`);
		return new BadGatewayException('Ever Works could not be reached.');
	}

	/** A short reason safe to store and log: a contract code and message, or a network code. Never a key or header. */
	private reason(error: unknown): string {
		if (error instanceof EverWorksApiError) return `${error.code}: ${error.message}`.slice(0, 500);
		if (error instanceof EverWorksNetworkError) return `network: ${error.reason}`;
		if (error instanceof HttpException) return `http_${error.getStatus()}`;
		if (error instanceof Error) return error.name;
		return 'unknown';
	}
}
