import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Subscription } from 'rxjs';
import { EverConnectAuditService } from './ever-connect-audit.service';
import { EVER_CONNECT_ENV } from './ever-connect.constants';
import { EverConnectEntitlementService } from './ever-connect-entitlement.service';
import { EverConnectIntegrationStateService } from './ever-connect-integration-state.service';
import { EverConnectLookupService } from './ever-connect-lookup.service';
import { EverConnectPlatformService, errorCode, isCredentialRevoked } from './ever-connect-platform.service';
import { EverConnectSecretStore } from './ever-connect-secret-store';
import { EverConnectSignals } from './ever-connect-signals';
import { EverConnectStore, IntegrationRecord, LinkRecord } from './ever-connect.store';
import { requiredFeature } from './integrations/integration-definitions';
import { IntegrationHandler, IntegrationHandlerRegistry } from './integrations/integration-handler.registry';
import { LookupInputError, lookupHash, normalizeIdentifier, ProblemError } from './sdk';
import {
	ORGANIZATION_IDENTIFIER_CHANGED,
	OrganizationIdentifierChange
} from './subscribers/organization-identifier.subscriber';

/** The integration this service runs. */
export const COUNTERPARTY_DISCOVERABLE = 'counterparty_discoverable';

/**
 * What is kept (sealed, on the integration's row) about the identifiers of one link:
 *
 * - `pushed`: the salt versions of the upload Ever Platform holds (none: nothing of this
 *   installation's is there);
 * - `digest`: the SHA-256 of that upload (the set of salted hashes), so an upload that would send
 *   the same set is not sent again, and a different one (a new tax id, a new salt version, an
 *   upload that raced another) is;
 * - `pending`: an upload or a removal that could not be sent yet (sent again at each heartbeat);
 * - `claimed`: the digest of an upload Ever Platform refused because another organization holds
 *   the identifier (not tried again until the upload would change).
 *
 * Never an identifier or a hash.
 */
export interface DiscoverableState {
	pushed: number[];
	digest: string | null;
	pending: 'push' | 'delete' | null;
	claimed?: string;
}

const empty = (): DiscoverableState => ({ pushed: [], digest: null, pending: null });

/** One salted hash of the upload, as the identifier upload takes it. */
type UploadHash = { kind: 'vat'; salt_version: number; hash: string };

/** The digest of an upload: SHA-256 of its hashes in salt version order. */
const digestOf = (hashes: UploadHash[]): string =>
	createHash('sha256')
		.update(
			JSON.stringify(
				[...hashes]
					.sort((a, b) => a.salt_version - b.salt_version)
					.map((hash) => [hash.salt_version, hash.hash])
			)
		)
		.digest('hex');

/**
 * Being findable by partners who already know this organization's tax id: the handler of
 * `counterparty_discoverable`.
 *
 * Nothing is computed or sent before the organization opted in: an owner or administrator of the
 * linked Ever organization enables it in app.ever.co (never from Gauzy), and its entitlement grants
 * `features.discoverability`. Then:
 *
 * - when Ever Platform reads it as enabled, the organization's tax id (`Organization.taxId`, with
 *   the country of its address when the number has no country prefix) is normalised and hashed here
 *   by the SDK under each active salt, and only the hashes are uploaded
 *   (`PUT /v1/instances/me/tenant-links/{link}/identifiers`); again on each change of the tax id
 *   (in the order of the changes, one link at a time);
 * - at each heartbeat the salts are read again and the upload is compared with what the
 *   organization holds now: a new salt version, a change this process did not see, or an upload
 *   that could not be sent is sent (within a day);
 * - a cleared tax id, or the integration switched off here or in app.ever.co, removes the upload
 *   (`DELETE /v1/instances/me/tenant-links/{link}/identifiers`), again at each heartbeat until Ever
 *   Platform takes it.
 *
 * Gauzy has no registration number or billing e-mail on an organization: those can be set in
 * app.ever.co. The tax id and its hashes are never logged or stored here.
 */
@Injectable()
export class EverConnectDiscoverableService implements IntegrationHandler, OnModuleInit, OnModuleDestroy {
	readonly key = COUNTERPARTY_DISCOVERABLE;
	private readonly logger = new Logger('EverConnect');
	private readonly secrets: EverConnectSecretStore;
	private subscription: Subscription | null = null;
	/** The work queued for each link (by its id): one upload or removal at a time, in order. */
	private readonly queues = new Map<string, Promise<void>>();

	constructor(
		private readonly platform: EverConnectPlatformService,
		private readonly store: EverConnectStore,
		private readonly states: EverConnectIntegrationStateService,
		private readonly entitlements: EverConnectEntitlementService,
		private readonly lookup: EverConnectLookupService,
		private readonly audit: EverConnectAuditService,
		private readonly signals: EverConnectSignals,
		private readonly handlers: IntegrationHandlerRegistry,
		@Optional() @Inject(EVER_CONNECT_ENV) env?: Record<string, string | undefined>
	) {
		this.secrets = new EverConnectSecretStore(env ?? process.env);
	}

	onModuleInit(): void {
		this.handlers.register(this);
		this.subscription = ORGANIZATION_IDENTIFIER_CHANGED.subscribe((change) => {
			this.identifierChanged(change).catch((error) =>
				this.logger.warn(`An organization's identifiers could not be uploaded (${errorCode(error)}).`)
			);
		});
	}

	onModuleDestroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
	}

	// ── The integration's handler ──────────────────────────────────────────────

	/** Enabled in app.ever.co: the identifiers are uploaded once. */
	async onEnable(row: IntegrationRecord): Promise<void> {
		await this.queued(row.scope, () => this.sync(row));
	}

	/** Off (here or in app.ever.co): the upload is removed. */
	async onDisable(row: IntegrationRecord): Promise<void> {
		await this.queued(row.scope, () => this.remove(row));
	}

	/**
	 * At each heartbeat, for each link: switched off, a removal not taken yet is sent again; enabled,
	 * the salts are read again (once) and the upload is compared with the organization's tax id now
	 * (sent when it differs, removed when the tax id is gone).
	 */
	async retry(): Promise<void> {
		const rows = await this.store.integrations({ name: COUNTERPARTY_DISCOVERABLE });
		let saltsRead = false;
		for (const row of rows) {
			await this.queued(row.scope, async () => {
				const current = (await this.store.integration(row.scope, row.name)) ?? row;
				const state = this.read(current);
				if (!current.enabled) {
					if (state.pending || state.pushed.length > 0) {
						await this.remove(current);
					}
					return;
				}
				if (!(await this.gate(current))) {
					return;
				}
				// Once a heartbeat (a day): the salts are read again, so a new version is used within a day.
				if (!saltsRead) {
					saltsRead = true;
					await this.lookup.salts({ refresh: true });
				}
				await this.sync(current);
			});
		}
	}

	// ── A change of the tax id ─────────────────────────────────────────────────

	/**
	 * The tax id of a Gauzy organization changed. Nothing is done (no hash, no request) unless the
	 * organization's link has the integration enabled and its entitlement grants the feature.
	 */
	identifierChanged(change: OrganizationIdentifierChange): Promise<void> {
		// Queued per organization at once, so the changes of one organization are handled in the order
		// they were saved; then with the link's other work.
		return this.queued(`organization:${change.tenantId}|${change.organizationId}`, async () => {
			const link = await this.store.linkOf(change.tenantId, change.organizationId);
			if (!link || link.status !== 'linked') {
				return;
			}
			const row = await this.store.integration(link.linkId, COUNTERPARTY_DISCOVERABLE);
			if (!row?.enabled) {
				return;
			}
			await this.queued(link.linkId, async () => {
				const current = (await this.store.integration(link.linkId, COUNTERPARTY_DISCOVERABLE)) ?? row;
				if (!(await this.gate(current))) {
					// Not now (the feature, the deny list, the connection): the heartbeat compares again later.
					return;
				}
				await this.sync(current, change.taxId);
			});
		});
	}

	// ── Upload and removal ─────────────────────────────────────────────────────

	/** Runs `work` after the work already queued under `key` (a link, or an organization): one at a time, in order. */
	private queued(key: string, work: () => Promise<void>): Promise<void> {
		const previous = this.queues.get(key) ?? Promise.resolve();
		const next = previous.catch(() => undefined).then(work);
		const tail = next.catch(() => undefined);
		this.queues.set(key, tail);
		void tail.then(() => {
			if (this.queues.get(key) === tail) this.queues.delete(key);
		});
		return next;
	}

	/**
	 * Whether identifiers of this row's link may be uploaded now: connected, not denied here, the
	 * link live, the integration enabled and `features.discoverability` granted. Makes no request.
	 */
	private async gate(row: IntegrationRecord): Promise<LinkRecord | null> {
		if (!row.enabled || row.state !== 'enabled') return null;
		const connection = await this.store.connection();
		if (connection.status !== 'connected' || (await this.states.deniedBy(COUNTERPARTY_DISCOVERABLE))) return null;
		const link = await this.store.linkById(row.scope);
		if (!link || link.status !== 'linked') return null;
		const feature = requiredFeature(COUNTERPARTY_DISCOVERABLE);
		if (feature) {
			const { features } = await this.entitlements.features(link.tenantId, link.organizationId);
			if (features[feature] !== true) return null;
		}
		return link;
	}

	/**
	 * Makes Ever Platform hold the hashes of the organization's tax id under each active salt (the
	 * whole set, which replaces the previous one), or nothing when it has no tax id that can be
	 * normalised. `taxId` is the value a change just wrote (read from the organization otherwise).
	 * Nothing is sent when Ever Platform already holds that set.
	 */
	private async sync(row: IntegrationRecord, taxId?: string | null): Promise<void> {
		const link = await this.gate(row);
		if (!link) {
			return;
		}
		const state = this.read(row);
		const organization = await this.store.organizationIdentifiers(link.tenantId, link.organizationId);
		const value = taxId !== undefined ? taxId : (organization?.taxId ?? null);
		let normalized: string | null = null;
		if (value && value.trim()) {
			try {
				normalized = normalizeIdentifier(
					'vat',
					value,
					organization?.country ? { country: organization.country } : undefined
				);
			} catch (error) {
				if (!(error instanceof LookupInputError)) throw error;
				normalized = null;
			}
		}
		if (normalized === null) {
			// No usable tax id: whatever was uploaded before is removed.
			if (state.pushed.length || state.pending) {
				await this.remove(row);
			} else if (state.claimed) {
				await this.write(row, empty());
			}
			return;
		}
		let hashes: UploadHash[];
		try {
			hashes = (await this.lookup.salts()).map((salt) => {
				const hash = lookupHash('vat', normalized as string, salt);
				return { kind: 'vat' as const, salt_version: hash.salt_version, hash: hash.hash };
			});
		} catch (error) {
			await this.write(row, { ...state, pending: 'push' });
			this.logger.warn(
				`An organization's identifiers could not be uploaded now (${errorCode(error)}); they are sent again at the next heartbeat.`
			);
			return;
		}
		const digest = digestOf(hashes);
		if (
			(state.digest === digest && state.pending !== 'push' && state.pending !== 'delete') ||
			state.claimed === digest
		) {
			// Ever Platform holds this set already (or refused it as another organization's).
			return;
		}
		try {
			await (await this.platform.getClient()).instances.identifiers.put(link.linkId, { hashes });
			await this.write(row, { pushed: hashes.map((hash) => hash.salt_version), digest, pending: null });
			await this.audit.record({
				action: 'identifiers.push',
				actorLabel: 'system',
				tenantId: link.tenantId,
				organizationId: link.organizationId,
				integration: COUNTERPARTY_DISCOVERABLE,
				details: { link_id: link.linkId, count: hashes.length }
			});
		} catch (error) {
			if (isCredentialRevoked(error)) {
				this.signals.revoked$.next();
				return;
			}
			if (error instanceof ProblemError && error.status === 409) {
				// Another organization holds this identifier on Ever Platform: nothing of it is uploaded,
				// and it is not tried again until the upload would change. It can be reviewed in app.ever.co.
				await this.write(row, { ...state, pending: state.pushed.length ? 'delete' : null, claimed: digest });
				if (state.pushed.length) await this.remove(row);
				this.logger.warn(`An organization's identifiers were not uploaded (${errorCode(error)}).`);
				return;
			}
			await this.write(row, { ...state, pending: 'push' });
			this.logger.warn(
				`An organization's identifiers could not be uploaded now (${errorCode(error)}); they are sent again at the next heartbeat.`
			);
		}
	}

	/**
	 * Removes the upload of this row's link (`DELETE …/identifiers`). Without a connection there is
	 * nothing to tell (Ever Platform removes a link's identifiers with it). A failure is kept and sent
	 * again at each heartbeat. Never throws.
	 */
	private async remove(row: IntegrationRecord): Promise<void> {
		const state = this.read(row);
		if (!state.pushed.length && !state.pending) {
			// Nothing of this installation's is on Ever Platform.
			if (state.claimed) await this.write(row, empty());
			return;
		}
		const connection = await this.store.connection();
		const link = await this.store.linkById(row.scope);
		if (connection.status !== 'connected' || !link || link.status === 'unlinked') {
			await this.write(row, empty());
			return;
		}
		try {
			await (await this.platform.getClient()).instances.identifiers.remove(link.linkId);
		} catch (error) {
			if (isCredentialRevoked(error)) {
				this.signals.revoked$.next();
				return;
			}
			// 404: none there; 403: the integration is already off there, and its identifiers with it.
			if (!(error instanceof ProblemError && (error.status === 404 || error.status === 403))) {
				await this.write(row, { ...state, pending: 'delete' });
				this.logger.warn(
					`An organization's identifiers could not be removed now (${errorCode(error)}); they are removed at the next heartbeat.`
				);
				return;
			}
		}
		await this.write(row, state.claimed ? { ...empty(), claimed: state.claimed } : empty());
		await this.audit.record({
			action: 'identifiers.delete',
			actorLabel: 'system',
			tenantId: link.tenantId,
			organizationId: link.organizationId,
			integration: COUNTERPARTY_DISCOVERABLE,
			details: { link_id: link.linkId }
		});
	}

	/** The state kept for one row (nothing uploaded when there is none, or it cannot be read). */
	read(row: IntegrationRecord): DiscoverableState {
		const text = this.secrets.open(row.configEncrypted, 'integration_config');
		if (!text) return empty();
		try {
			const parsed = JSON.parse(text) as Partial<DiscoverableState>;
			const hex = (value: unknown) => (typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) ? value : null);
			const claimed = hex(parsed.claimed);
			return {
				pushed: Array.isArray(parsed.pushed) ? parsed.pushed.filter((v) => Number.isSafeInteger(v)) : [],
				digest: hex(parsed.digest),
				pending: parsed.pending === 'push' || parsed.pending === 'delete' ? parsed.pending : null,
				...(claimed ? { claimed } : {})
			};
		} catch {
			return empty();
		}
	}

	private async write(row: IntegrationRecord, state: DiscoverableState): Promise<void> {
		const nothing = !state.pushed.length && !state.pending && !state.claimed;
		let sealed: string | null = null;
		if (!nothing) {
			try {
				sealed = this.secrets.seal(JSON.stringify(state), 'integration_config');
			} catch (error) {
				this.logger.warn(`The state of an organization's identifiers could not be kept (${errorCode(error)}).`);
				return;
			}
		}
		await this.store.saveIntegration(row.scope, row.name, { configEncrypted: sealed });
		row.configEncrypted = sealed;
	}
}
