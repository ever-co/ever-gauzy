import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { CONNECTION_ROW_ID, EVER_CONNECT_CLOCK, LINK_INTEGRATION_NAME } from './ever-connect.constants';
import { EverConnectSql, flag, num, Row, str } from './ever-connect-sql';

/** The connection row as the plugin reads it. */
export interface ConnectionRecord {
	platformInstanceId: string | null;
	kid: string | null;
	ownerOrgId: string | null;
	ownerHandle: string | null;
	apiUrl: string | null;
	publicUrl: string | null;
	status: 'connected' | 'pending_approval' | 'revoked' | 'disconnected';
	connectedAt: number | null;
	connectedByUserId: string | null;
	lastHeartbeatAt: number | null;
	nextHeartbeatAt: number | null;
	leasedBy: string | null;
	leaseUntil: number | null;
	feedCursor: string | null;
	envCodeConsumedHash: string | null;
	envCodeAttempts: number;
	envCodeNextAttemptAt: number | null;
	lastError: string | null;
	revokedAt: number | null;
	instanceEntitlementJwsEncrypted: string | null;
	instanceEntitlementSeq: number | null;
	instanceEntitlementIat: number | null;
	instanceEntitlementExp: number | null;
	instanceEntitlementFetchedAt: number | null;
}

/** A tenant link as the plugin reads it. */
export interface LinkRecord {
	id: string;
	tenantId: string;
	organizationId: string;
	integrationTenantId: string | null;
	linkId: string;
	everOrgId: string;
	everHandle: string | null;
	status: 'linked' | 'suspended' | 'orphaned' | 'unlinked';
	entitlementJwsEncrypted: string | null;
	entitlementSeq: number | null;
	entitlementIat: number | null;
	entitlementExp: number | null;
	entitlementFetchedAt: number | null;
	createdAt: number;
	unlinkedAt: number | null;
}

/** The local state of one integration. */
export interface IntegrationRecord {
	id: string;
	scope: string;
	name: string;
	tenantId: string | null;
	organizationId: string | null;
	integrationTenantId: string | null;
	scopeVersion: number | null;
	enabled: boolean;
	state: string;
	operatorAccept: string | null;
	consentId: string | null;
	consentedAt: number | null;
	consentedByLabel: string | null;
	consentSource: string | null;
	termsVersion: string | null;
	dpaVersion: string | null;
	revokedAt: number | null;
	revokeSource: string | null;
	pendingRemoteRevoke: boolean;
	updatedAt: number;
}

export interface PolicyRecord {
	integration: string;
	allowed: boolean;
	source: string;
	changedByUserId: string | null;
	changedAt: number;
}

const CONNECTION = 'ever_connect_connection';
const LINK = 'ever_connect_link';
const INTEGRATION = 'ever_connect_integration';
const POLICY = 'ever_connect_policy';
const LOOKUP_CACHE = 'ever_connect_lookup_cache';
const AUDIT = 'ever_connect_audit';

function toConnection(row: Row): ConnectionRecord {
	return {
		platformInstanceId: str(row['platformInstanceId']),
		kid: str(row['kid']),
		ownerOrgId: str(row['ownerOrgId']),
		ownerHandle: str(row['ownerHandle']),
		apiUrl: str(row['apiUrl']),
		publicUrl: str(row['publicUrl']),
		status: (str(row['status']) ?? 'disconnected') as ConnectionRecord['status'],
		connectedAt: num(row['connectedAt']),
		connectedByUserId: str(row['connectedByUserId']),
		lastHeartbeatAt: num(row['lastHeartbeatAt']),
		nextHeartbeatAt: num(row['nextHeartbeatAt']),
		leasedBy: str(row['leasedBy']),
		leaseUntil: num(row['leaseUntil']),
		feedCursor: str(row['feedCursor']),
		envCodeConsumedHash: str(row['envCodeConsumedHash']),
		envCodeAttempts: num(row['envCodeAttempts']) ?? 0,
		envCodeNextAttemptAt: num(row['envCodeNextAttemptAt']),
		lastError: str(row['lastError']),
		revokedAt: num(row['revokedAt']),
		instanceEntitlementJwsEncrypted: str(row['instanceEntitlementJwsEncrypted']),
		instanceEntitlementSeq: num(row['instanceEntitlementSeq']),
		instanceEntitlementIat: num(row['instanceEntitlementIat']),
		instanceEntitlementExp: num(row['instanceEntitlementExp']),
		instanceEntitlementFetchedAt: num(row['instanceEntitlementFetchedAt'])
	};
}

function toLink(row: Row): LinkRecord {
	return {
		id: String(row['id']),
		tenantId: String(row['tenantId']),
		organizationId: String(row['organizationId']),
		integrationTenantId: str(row['integrationTenantId']),
		linkId: String(row['linkId']),
		everOrgId: String(row['everOrgId']),
		everHandle: str(row['everHandle']),
		status: String(row['status']) as LinkRecord['status'],
		entitlementJwsEncrypted: str(row['entitlementJwsEncrypted']),
		entitlementSeq: num(row['entitlementSeq']),
		entitlementIat: num(row['entitlementIat']),
		entitlementExp: num(row['entitlementExp']),
		entitlementFetchedAt: num(row['entitlementFetchedAt']),
		createdAt: num(row['createdAt']) ?? 0,
		unlinkedAt: num(row['unlinkedAt'])
	};
}

function toIntegration(row: Row): IntegrationRecord {
	return {
		id: String(row['id']),
		scope: String(row['scope']),
		name: String(row['name']),
		tenantId: str(row['tenantId']),
		organizationId: str(row['organizationId']),
		integrationTenantId: str(row['integrationTenantId']),
		scopeVersion: num(row['scopeVersion']),
		enabled: flag(row['enabled']),
		state: String(row['state']),
		operatorAccept: str(row['operatorAccept']),
		consentId: str(row['consentId']),
		consentedAt: num(row['consentedAt']),
		consentedByLabel: str(row['consentedByLabel']),
		consentSource: str(row['consentSource']),
		termsVersion: str(row['termsVersion']),
		dpaVersion: str(row['dpaVersion']),
		revokedAt: num(row['revokedAt']),
		revokeSource: str(row['revokeSource']),
		pendingRemoteRevoke: flag(row['pendingRemoteRevoke']),
		updatedAt: num(row['updatedAt']) ?? 0
	};
}

/** A Gauzy organization already has a live link (one live link per organization). */
export class LiveLinkExistsError extends Error {
	constructor() {
		super('This organization already has a live link.');
		this.name = 'LiveLinkExistsError';
	}
}

/** The unique key of a live link: its Gauzy tenant and organization. */
export const liveKeyOf = (tenantId: string, organizationId: string): string => `${tenantId}|${organizationId}`;

/**
 * Reads and writes the plugin's tables, and Gauzy's own record of a tenant link (an
 * `integration_tenant` row named `Ever_Connect` with its settings).
 */
@Injectable()
export class EverConnectStore {
	readonly sql: EverConnectSql;
	private readonly now: () => number;

	constructor(dataSource: DataSource, @Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }) {
		this.sql = new EverConnectSql(dataSource);
		this.now = clock?.now ?? (() => Date.now());
	}

	// ── Connection ────────────────────────────────────────────────────────────

	/** The connection row (created, disconnected, on first read). */
	async connection(): Promise<ConnectionRecord> {
		let row = await this.sql.one(CONNECTION, { id: CONNECTION_ROW_ID });
		if (!row) {
			const at = this.now();
			await this.sql.insertIgnore(CONNECTION, {
				id: CONNECTION_ROW_ID,
				status: 'disconnected',
				envCodeAttempts: 0,
				createdAt: at,
				updatedAt: at
			});
			row = await this.sql.one(CONNECTION, { id: CONNECTION_ROW_ID });
		}
		return toConnection(row as Row);
	}

	async updateConnection(values: Partial<Record<keyof ConnectionRecord, unknown>>, where: Row = {}): Promise<number> {
		await this.connection();
		return this.sql.update(CONNECTION, { ...values, updatedAt: this.now() }, { id: CONNECTION_ROW_ID, ...where });
	}

	/**
	 * Takes (or renews) the lease that lets one API process run the heartbeat and the event feed:
	 * compare and set on the connection row. Returns whether this process holds it.
	 */
	async takeLease(holder: string, durationMs: number): Promise<boolean> {
		await this.connection();
		const at = this.now();
		const q = (c: string) => this.sql.q(c);
		const { affected } = await this.sql.run(
			`UPDATE ${q(CONNECTION)} SET ${q('leasedBy')} = ${this.sql.ph(1)}, ${q('leaseUntil')} = ${this.sql.ph(2)} ` +
				`WHERE ${q('id')} = ${this.sql.ph(3)} AND (${q('leasedBy')} IS NULL OR ${q('leasedBy')} = ${this.sql.ph(4)} OR ${q('leaseUntil')} IS NULL OR ${q('leaseUntil')} <= ${this.sql.ph(5)})`,
			[holder, at + durationMs, CONNECTION_ROW_ID, holder, at]
		);
		return affected === 1;
	}

	async releaseLease(holder: string): Promise<void> {
		await this.sql.update(
			CONNECTION,
			{ leasedBy: null, leaseUntil: null },
			{ id: CONNECTION_ROW_ID, leasedBy: holder }
		);
	}

	/** Claims the next attempt of `EVER_CONNECT_CODE` (compare and set): only one process runs it. */
	async claimEnvCodeAttempt(expectedNext: number | null, retryAt: number): Promise<boolean> {
		await this.connection();
		const q = (c: string) => this.sql.q(c);
		const params: unknown[] = [retryAt, CONNECTION_ROW_ID];
		let condition = `${q('envCodeNextAttemptAt')} IS NULL`;
		if (expectedNext !== null) {
			params.push(expectedNext);
			condition = `${q('envCodeNextAttemptAt')} = ${this.sql.ph(3)}`;
		}
		const { affected } = await this.sql.run(
			`UPDATE ${q(CONNECTION)} SET ${q('envCodeNextAttemptAt')} = ${this.sql.ph(1)} WHERE ${q('id')} = ${this.sql.ph(2)} AND ${condition}`,
			params
		);
		return affected === 1;
	}

	// ── Tenant links ──────────────────────────────────────────────────────────

	/** The live link of one Gauzy organization (not unlinked), or `null`. */
	async linkOf(tenantId: string, organizationId: string): Promise<LinkRecord | null> {
		const rows = await this.sql.select(LINK, { tenantId, organizationId }, { orderBy: [['createdAt', 'DESC']] });
		const live = rows.map(toLink).find((link) => link.status !== 'unlinked');
		return live ?? null;
	}

	async linkById(linkId: string): Promise<LinkRecord | null> {
		const row = await this.sql.one(LINK, { linkId });
		return row ? toLink(row) : null;
	}

	async linkByIntegrationTenant(integrationTenantId: string): Promise<LinkRecord | null> {
		const row = await this.sql.one(LINK, { integrationTenantId });
		return row ? toLink(row) : null;
	}

	/** Every link that is not unlinked. */
	async liveLinks(): Promise<LinkRecord[]> {
		const rows = await this.sql.select(LINK, {}, { orderBy: [['createdAt', 'ASC']] });
		return rows.map(toLink).filter((link) => link.status !== 'unlinked');
	}

	/**
	 * Inserts a live link. The unique `liveKey` (`<tenantId>|<organizationId>`) refuses a second live
	 * link for one Gauzy organization, also when two requests race: {@link LiveLinkExistsError}.
	 */
	async insertLink(
		values: Omit<LinkRecord, 'id' | 'createdAt' | 'unlinkedAt'> & { linkedByUserId?: string | null }
	): Promise<LinkRecord> {
		const at = this.now();
		const id = randomUUID();
		try {
			await this.sql.insert(LINK, {
				id,
				...values,
				liveKey: liveKeyOf(values.tenantId, values.organizationId),
				createdAt: at,
				updatedAt: at,
				unlinkedAt: null
			});
		} catch (error) {
			if (await this.linkOf(values.tenantId, values.organizationId)) {
				throw new LiveLinkExistsError();
			}
			throw error;
		}
		return (await this.linkById(values.linkId)) as LinkRecord;
	}

	/** Updates a link; once it is `unlinked`, it no longer holds its organization's live key. */
	async updateLink(linkId: string, values: Partial<Record<keyof LinkRecord | 'liveKey', unknown>>): Promise<void> {
		const extra = values['status'] === 'unlinked' ? { liveKey: null } : {};
		await this.sql.update(LINK, { ...values, ...extra, updatedAt: this.now() }, { linkId });
	}

	/** Updates a link only while it still matches `where` (compare and set); answers whether it did. */
	async updateLinkIf(
		linkId: string,
		values: Partial<Record<keyof LinkRecord, unknown>>,
		where: Partial<Record<keyof LinkRecord, unknown>>
	): Promise<boolean> {
		const changed = await this.sql.update(LINK, { ...values, updatedAt: this.now() }, { ...where, linkId } as Row);
		return changed !== 0;
	}

		/** Removes a link row that was never completed (its Gauzy record could not be written). */
	async deleteLink(linkId: string): Promise<void> {
		await this.sql.run(`DELETE FROM ${this.sql.q(LINK)} WHERE ${this.sql.q('linkId')} = ${this.sql.ph(1)}`, [linkId]);
	}

	// ── Integrations ──────────────────────────────────────────────────────────

	async integrations(where: Row = {}): Promise<IntegrationRecord[]> {
		const rows = await this.sql.select(INTEGRATION, where, { orderBy: [['name', 'ASC']] });
		return rows.map(toIntegration);
	}

	async integration(scope: string, name: string): Promise<IntegrationRecord | null> {
		const row = await this.sql.one(INTEGRATION, { scope, name });
		return row ? toIntegration(row) : null;
	}

	/** Writes the state of one integration (created on first write). */
	async saveIntegration(
		scope: string,
		name: string,
		values: Partial<Record<keyof IntegrationRecord, unknown>>,
		owner: { tenantId?: string | null; organizationId?: string | null; integrationTenantId?: string | null } = {}
	): Promise<IntegrationRecord> {
		const at = this.now();
		const existing = await this.integration(scope, name);
		if (!existing) {
			await this.sql.insertIgnore(INTEGRATION, {
				id: randomUUID(),
				scope,
				name,
				tenantId: owner.tenantId ?? null,
				organizationId: owner.organizationId ?? null,
				integrationTenantId: owner.integrationTenantId ?? null,
				enabled: false,
				state: 'available',
				pendingRemoteRevoke: false,
				createdAt: at,
				updatedAt: at
			});
		}
		if (Object.keys(values).length) {
			await this.sql.update(INTEGRATION, { ...values, updatedAt: at }, { scope, name });
		}
		return (await this.integration(scope, name)) as IntegrationRecord;
	}

	// ── Policy ────────────────────────────────────────────────────────────────

	async policies(): Promise<PolicyRecord[]> {
		const rows = await this.sql.select(POLICY, {}, { orderBy: [['integration', 'ASC']] });
		return rows.map((row) => ({
			integration: String(row['integration']),
			allowed: flag(row['allowed']),
			source: String(row['source']),
			changedByUserId: str(row['changedByUserId']),
			changedAt: num(row['changedAt']) ?? 0
		}));
	}

	async setPolicy(integration: string, allowed: boolean, userId: string | null): Promise<void> {
		const at = this.now();
		const inserted = await this.sql.insertIgnore(POLICY, {
			integration,
			allowed,
			source: 'ui',
			changedByUserId: userId,
			changedAt: at
		});
		if (!inserted) {
			await this.sql.update(
				POLICY,
				{ allowed, source: 'ui', changedByUserId: userId, changedAt: at },
				{ integration }
			);
		}
	}

	// ── Deleted Gauzy tenants and organizations ───────────────────────────────

	/**
	 * The (tenant, organization) pairs the plugin's tables still hold although that Gauzy tenant or
	 * organization was deleted (or soft-deleted). There are no foreign keys to cascade (the tables are
	 * the plugin's own), so this is how a deletion reaches them.
	 */
	async deletedOwners(): Promise<Array<{ tenantId: string; organizationId: string | null }>> {
		const q = (c: string) => this.sql.q(c);
		// Gauzy's ids are uuid on Postgres; the plugin keeps them as text.
		const text = (expr: string) => (this.sql.dialect === 'postgres' ? `${expr}::text` : expr);
		const found = new Map<string, { tenantId: string; organizationId: string | null }>();
		for (const table of [LINK, INTEGRATION, LOOKUP_CACHE, AUDIT]) {
			const { rows } = await this.sql.run(
				`SELECT DISTINCT t.${q('tenantId')} AS ${q('tenantId')}, t.${q('organizationId')} AS ${q('organizationId')} FROM ${q(table)} t ` +
					`WHERE t.${q('tenantId')} IS NOT NULL AND (` +
					`NOT EXISTS (SELECT 1 FROM ${q('tenant')} x WHERE ${text(`x.${q('id')}`)} = t.${q('tenantId')} AND x.${q('deletedAt')} IS NULL) ` +
					`OR (t.${q('organizationId')} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${q('organization')} o WHERE ${text(`o.${q('id')}`)} = t.${q('organizationId')} AND o.${q('deletedAt')} IS NULL)))`
			);
			for (const row of rows) {
				const owner = { tenantId: String(row['tenantId']), organizationId: str(row['organizationId']) };
				found.set(`${owner.tenantId}|${owner.organizationId ?? ''}`, owner);
			}
		}
		return [...found.values()];
	}

	/**
	 * Removes what the plugin keeps for a deleted Gauzy organization (or, without `organizationId`, for
	 * every organization of a deleted tenant): its links, integration states and lookup cache rows.
	 */
	async purgeOwner(owner: { tenantId: string; organizationId: string | null }): Promise<void> {
		const q = (c: string) => this.sql.q(c);
		const params: unknown[] = [owner.tenantId];
		let where = `${q('tenantId')} = ${this.sql.ph(1)}`;
		if (owner.organizationId) {
			params.push(owner.organizationId);
			where += ` AND ${q('organizationId')} = ${this.sql.ph(2)}`;
		}
		for (const table of [INTEGRATION, LOOKUP_CACHE, LINK]) {
			await this.sql.run(`DELETE FROM ${q(table)} WHERE ${where}`, params);
		}
	}

	/** The links (any state) of one owner, as {@link purgeOwner} scopes it. */
	async linksOf(owner: { tenantId: string; organizationId: string | null }): Promise<LinkRecord[]> {
		const where: Row = { tenantId: owner.tenantId };
		if (owner.organizationId) where['organizationId'] = owner.organizationId;
		return (await this.sql.select(LINK, where)).map(toLink);
	}

	// ── Who may act for an organization ─────────────────────────────────────────

	/** Whether `userId` is an active member of the organization (`user_organization`), in its tenant. */
	async isMember(tenantId: string, organizationId: string, userId: string): Promise<boolean> {
		const q = (c: string) => this.sql.q(c);
		const yes = this.sql.dialect === 'postgres' ? 'true' : '1';
		const { rows } = await this.sql.run(
			`SELECT COUNT(*) AS ${q('n')} FROM ${q('user_organization')} WHERE ${q('tenantId')} = ${this.sql.ph(1)} AND ${q('organizationId')} = ${this.sql.ph(2)} AND ${q('userId')} = ${this.sql.ph(3)} ` +
				`AND ${q('deletedAt')} IS NULL AND (${q('isActive')} IS NULL OR ${q('isActive')} = ${yes})`,
			[tenantId, organizationId, userId]
		);
		return (num(rows[0]?.['n']) ?? 0) > 0;
	}

	// ── Gauzy's own record of a link: integration_tenant + integration_setting ──

	/**
	 * Creates the `integration_tenant` row of a link (name `Ever_Connect`, under the `Ever_Connect`
	 * catalog row when it exists) with the link's ids, handle and status as its settings. Returns its id.
	 */
	async createLinkRecord(
		owner: { tenantId: string; organizationId: string },
		settings: Record<string, string>
	): Promise<string> {
		const id = randomUUID();
		const catalog = await this.sql.one('integration', { name: LINK_INTEGRATION_NAME });
		await this.sql.insert('integration_tenant', {
			id,
			tenantId: owner.tenantId,
			organizationId: owner.organizationId,
			name: LINK_INTEGRATION_NAME,
			integrationId: catalog ? String(catalog['id']) : null,
			isActive: true,
			isArchived: false
		});
		for (const [settingsName, settingsValue] of Object.entries(settings)) {
			await this.sql.insert('integration_setting', {
				id: randomUUID(),
				tenantId: owner.tenantId,
				organizationId: owner.organizationId,
				integrationId: id,
				settingsName,
				settingsValue,
				isActive: true,
				isArchived: false
			});
		}
		return id;
	}

	/** Updates settings of a link's `integration_tenant` row. */
	async updateLinkRecordSettings(integrationTenantId: string, settings: Record<string, string>): Promise<void> {
		for (const [settingsName, settingsValue] of Object.entries(settings)) {
			await this.sql.update(
				'integration_setting',
				{ settingsValue },
				{ integrationId: integrationTenantId, settingsName }
			);
		}
	}

	/** Soft-archives a link's `integration_tenant` row, as Gauzy archives a removed integration. */
	async archiveLinkRecord(integrationTenantId: string): Promise<void> {
		await this.sql.update('integration_tenant', { isActive: false, isArchived: true }, { id: integrationTenantId });
	}
}
