import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
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
 * What is kept (sealed, on the integration's row) about the identifiers of one link: the salt
 * versions they were last uploaded under (none: nothing is on Ever Platform), an upload or a
 * removal that could not be sent yet (sent again at each heartbeat), and whether Ever Platform
 * refused the upload because another organization holds the identifier (not tried again until the
 * tax id changes). Never an identifier or a hash.
 */
export interface DiscoverableState {
	pushed: number[];
	pending: 'push' | 'delete' | null;
	claimed?: boolean;
}

const empty = (): DiscoverableState => ({ pushed: [], pending: null });

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
 *   (`PUT /v1/instances/me/tenant-links/{link}/identifiers`); again on each change of the tax id;
 * - at each heartbeat the salts are read again; under a new salt version the identifier is hashed
 *   and uploaded again (within a day);
 * - switched off here or in app.ever.co, the upload is removed
 *   (`DELETE /v1/instances/me/tenant-links/{link}/identifiers`), and removed again at each heartbeat
 *   until Ever Platform takes it.
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
		await this.push(row);
	}

	/** Off (here or in app.ever.co): the upload is removed. */
	async onDisable(row: IntegrationRecord): Promise<void> {
		await this.remove(row);
	}

	/**
	 * At each heartbeat: a removal or an upload that could not be sent is sent again; for each link
	 * with the integration enabled, the salts are read again and, under a new salt version, the
	 * identifiers are hashed and uploaded again.
	 */
	async retry(): Promise<void> {
		const rows = await this.store.integrations({ name: COUNTERPARTY_DISCOVERABLE });
		let salts: number[] | null = null;
		for (const row of rows) {
			const state = this.read(row);
			if (!row.enabled) {
				if (state.pending === 'delete' || state.pushed.length > 0) {
					await this.remove(row);
				}
				continue;
			}
			if (state.pending === 'push' || (!state.pushed.length && !state.claimed)) {
				// Not sent yet (Ever Platform could not be reached, or the feature was granted later):
				// nothing is sent when the organization has no tax id.
				await this.push(row);
				continue;
			}
			if (!state.pushed.length || !(await this.gate(row))) {
				continue;
			}
			// Once a heartbeat (a day): the salts are read again, so a new version is used within a day.
			salts ??= (await this.lookup.salts({ refresh: true })).map((salt) => salt.version).sort((a, b) => a - b);
			const pushed = [...state.pushed].sort((a, b) => a - b);
			if (JSON.stringify(pushed) !== JSON.stringify(salts)) {
				await this.push(row);
			}
		}
	}

	// ── A change of the tax id ─────────────────────────────────────────────────

	/**
	 * The tax id of a Gauzy organization changed. Nothing is done (no hash, no request) unless the
	 * organization's link has the integration enabled and its entitlement grants the feature.
	 */
	async identifierChanged(change: OrganizationIdentifierChange): Promise<void> {
		const link = await this.store.linkOf(change.tenantId, change.organizationId);
		if (!link || link.status !== 'linked') {
			return;
		}
		const row = await this.store.integration(link.linkId, COUNTERPARTY_DISCOVERABLE);
		if (!row?.enabled) {
			return;
		}
		await this.push(row, change.taxId, true);
	}

	// ── Upload and removal ─────────────────────────────────────────────────────

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
	 * Uploads the hashes of the organization's tax id under each active salt (the whole set, which
	 * replaces the previous one); removes the upload when the tax id was cleared or cannot be
	 * normalised. `taxId` is the value a change just wrote (read from the organization otherwise).
	 */
	private async push(row: IntegrationRecord, taxId?: string | null, changed = false): Promise<void> {
		const link = await this.gate(row);
		if (!link) {
			return;
		}
		const state = this.read(row);
		if (state.claimed && !changed) {
			return;
		}
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
			if (state.pushed.length || state.pending === 'push') {
				await this.remove(row);
			}
			return;
		}
		try {
			const salts = await this.lookup.salts();
			const hashes = salts
				.map((salt) => lookupHash('vat', normalized as string, salt))
				.map((hash) => ({ kind: hash.kind, salt_version: hash.salt_version, hash: hash.hash }));
			await (await this.platform.getClient()).instances.identifiers.put(link.linkId, { hashes });
			await this.write(row, { pushed: hashes.map((hash) => hash.salt_version), pending: null });
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
				// Another organization holds this identifier on Ever Platform: nothing is uploaded, and it
				// is not tried again until the tax id changes. It can be reviewed in app.ever.co.
				await this.write(row, { pushed: [], pending: null, claimed: true });
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
		if (!state.pushed.length && state.pending !== 'push' && state.pending !== 'delete') {
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
				await this.write(row, { pushed: state.pushed, pending: 'delete' });
				this.logger.warn(
					`An organization's identifiers could not be removed now (${errorCode(error)}); they are removed at the next heartbeat.`
				);
				return;
			}
		}
		await this.write(row, empty());
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
			return {
				pushed: Array.isArray(parsed.pushed) ? parsed.pushed.filter((v) => Number.isSafeInteger(v)) : [],
				pending: parsed.pending === 'push' || parsed.pending === 'delete' ? parsed.pending : null,
				...(parsed.claimed === true ? { claimed: true } : {})
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
