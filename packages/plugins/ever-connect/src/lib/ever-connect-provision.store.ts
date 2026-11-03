import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EVER_CONNECT_CLOCK, LINK_INTEGRATION_NAME } from './ever-connect.constants';
import { EverConnectSql, num, Row, str } from './ever-connect-sql';

const INTENT = 'ever_connect_provision_intent';
const RESULT = 'ever_connect_provision_result';

/** A signed request received, as the plugin reads it (`ever_connect_provision_intent`). */
export interface ProvisionIntentRecord {
	jti: string;
	/** The verified claims, as JSON. */
	intent: string;
	keyHash: string;
	idempotencyKey: string;
	status: 'pending' | 'accepted' | 'rejected' | 'expired';
	receivedAt: number;
	expiresAt: number;
}

/** The ids a workspace creation made. */
export interface ProvisionIds {
	productTenantId: string | null;
	productOrgId: string | null;
	productUserId: string | null;
	employeeId: string | null;
	teamId: string | null;
}

/** One workspace creation, as the plugin reads it (`ever_connect_provision_result`). */
export interface ProvisionResultRecord extends ProvisionIds {
	idempotencyKey: string;
	jti: string;
	status: 'pending' | 'created' | 'failed';
	everOrgId: string | null;
	integrationTenantId: string | null;
	errorCode: string | null;
	claimedBy: string | null;
	claimedUntil: number | null;
	completionState: 'pending' | 'done' | 'failed' | null;
	completionAttempts: number;
	completionNextAt: number | null;
	completionError: string | null;
	completedAt: number | null;
	tenantLinkId: string | null;
	createdAt: number;
}

/** What {@link EverConnectProvisionStore.claim} found. */
export type ProvisionClaim =
	| { outcome: 'claimed'; record: ProvisionResultRecord }
	| { outcome: 'created'; record: ProvisionResultRecord }
	| { outcome: 'busy'; record: ProvisionResultRecord }
	| { outcome: 'replayed' };

/** A statement runner inside a transaction someone else opened. */
export interface ProvisionTx {
	query(sql: string, params?: unknown[]): Promise<unknown>;
}

function toIntent(row: Row): ProvisionIntentRecord {
	return {
		jti: String(row['jti']),
		intent: String(row['intent'] ?? ''),
		keyHash: String(row['keyHash']),
		idempotencyKey: String(row['idempotencyKey']),
		status: String(row['status']) as ProvisionIntentRecord['status'],
		receivedAt: num(row['receivedAt']) ?? 0,
		expiresAt: num(row['expiresAt']) ?? 0
	};
}

function toResult(row: Row): ProvisionResultRecord {
	return {
		idempotencyKey: String(row['idempotencyKey']),
		jti: String(row['jti']),
		status: String(row['status']) as ProvisionResultRecord['status'],
		everOrgId: str(row['everOrgId']),
		productTenantId: str(row['productTenantId']),
		productOrgId: str(row['productOrgId']),
		productUserId: str(row['productUserId']),
		employeeId: str(row['employeeId']),
		teamId: str(row['teamId']),
		integrationTenantId: str(row['integrationTenantId']),
		errorCode: str(row['errorCode']),
		claimedBy: str(row['claimedBy']),
		claimedUntil: num(row['claimedUntil']),
		completionState: str(row['completionState']) as ProvisionResultRecord['completionState'],
		completionAttempts: num(row['completionAttempts']) ?? 0,
		completionNextAt: num(row['completionNextAt']),
		completionError: str(row['completionError']),
		completedAt: num(row['completedAt']),
		tenantLinkId: str(row['tenantLinkId']),
		createdAt: num(row['createdAt']) ?? 0
	};
}

/**
 * The tables of creating a workspace from Ever: the signed requests received (by `jti`), and one row
 * per idempotency key with the workspace created for it and the completion report to Ever Platform.
 */
@Injectable()
export class EverConnectProvisionStore {
	readonly sql: EverConnectSql;
	private readonly now: () => number;

	constructor(dataSource: DataSource, @Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }) {
		this.sql = new EverConnectSql(dataSource);
		this.now = clock?.now ?? (() => Date.now());
	}

	// ── Requests ──────────────────────────────────────────────────────────────

	async intent(jti: string): Promise<ProvisionIntentRecord | null> {
		const row = await this.sql.one(INTENT, { jti });
		return row ? toIntent(row) : null;
	}

	async intentByKey(keyHash: string): Promise<ProvisionIntentRecord | null> {
		const row = await this.sql.one(INTENT, { keyHash });
		return row ? toIntent(row) : null;
	}

	/**
	 * Records a verified request (pending) under the digest of a new one-time key. A request received
	 * again (the person opened the link twice) keeps its row and gets the new key: the older key stops
	 * working. Answers `false` when the `jti` is already recorded under another idempotency key.
	 */
	async saveIntent(values: { jti: string; intent: string; keyHash: string; idempotencyKey: string; expiresAt: number }): Promise<boolean> {
		const at = this.now();
		const inserted = await this.sql.insertIgnore(INTENT, {
			...values,
			status: 'pending',
			result: null,
			receivedAt: at,
			updatedAt: at
		});
		if (inserted) return true;
		const existing = await this.intent(values.jti);
		if (!existing || existing.idempotencyKey !== values.idempotencyKey) return false;
		await this.sql.update(INTENT, { keyHash: values.keyHash, updatedAt: at }, { jti: values.jti });
		return true;
	}

	async markIntent(jti: string, status: ProvisionIntentRecord['status'], result: unknown = null): Promise<void> {
		await this.sql.update(
			INTENT,
			{ status, result: result === null ? null : JSON.stringify(result), updatedAt: this.now() },
			{ jti }
		);
	}

	/** Removes requests that expired more than a day ago and never created anything. */
	async purgeExpired(): Promise<number> {
		const q = (c: string) => this.sql.q(c);
		const { affected } = await this.sql.run(
			`DELETE FROM ${q(INTENT)} WHERE ${q('expiresAt')} < ${this.sql.ph(1)} AND ${q('status')} <> ${this.sql.ph(2)}`,
			[this.now() - 24 * 3_600_000, 'accepted']
		);
		return affected;
	}

	// ── Results ───────────────────────────────────────────────────────────────

	async result(idempotencyKey: string): Promise<ProvisionResultRecord | null> {
		const row = await this.sql.one(RESULT, { idempotencyKey });
		return row ? toResult(row) : null;
	}

	async resultByJti(jti: string): Promise<ProvisionResultRecord | null> {
		const row = await this.sql.one(RESULT, { jti });
		return row ? toResult(row) : null;
	}

	/**
	 * Claims the creation of `idempotencyKey` for `holder` until `until`: a new row (pending), or one a
	 * failed or stopped attempt left behind. Answers who has it: this attempt (`claimed`), a finished
	 * creation (`created`), another attempt still within its claim (`busy`), or a request whose `jti`
	 * was used under another key (`replayed`).
	 */
	async claim(values: { idempotencyKey: string; jti: string; everOrgId: string }, holder: string, until: number): Promise<ProvisionClaim> {
		const at = this.now();
		try {
			const inserted = await this.sql.insertIgnore(RESULT, {
				...values,
				status: 'pending',
				claimedBy: holder,
				claimedUntil: until,
				completionAttempts: 0,
				createdAt: at,
				updatedAt: at
			});
			if (inserted) {
				return { outcome: 'claimed', record: (await this.result(values.idempotencyKey)) as ProvisionResultRecord };
			}
		} catch {
			// A unique key other than the primary one (the jti under another key) refuses the row.
		}
		const existing = await this.result(values.idempotencyKey);
		if (!existing || existing.jti !== values.jti) {
			return { outcome: 'replayed' };
		}
		if (existing.status === 'created') {
			return { outcome: 'created', record: existing };
		}
		const q = (c: string) => this.sql.q(c);
		const { affected } = await this.sql.run(
			`UPDATE ${q(RESULT)} SET ${q('claimedBy')} = ${this.sql.ph(1)}, ${q('claimedUntil')} = ${this.sql.ph(2)}, ${q('status')} = ${this.sql.ph(3)}, ${q('updatedAt')} = ${this.sql.ph(4)} ` +
				`WHERE ${q('idempotencyKey')} = ${this.sql.ph(5)} AND ${q('status')} <> ${this.sql.ph(6)} AND (${q('claimedUntil')} IS NULL OR ${q('claimedUntil')} < ${this.sql.ph(7)})`,
			[holder, until, 'pending', at, values.idempotencyKey, 'created', at]
		);
		const record = (await this.result(values.idempotencyKey)) as ProvisionResultRecord;
		if (affected > 0 && record.claimedBy === holder) {
			return { outcome: 'claimed', record };
		}
		return record.status === 'created' ? { outcome: 'created', record } : { outcome: 'busy', record };
	}

	/** Keeps the ids created so far (only while `holder` still has the claim). */
	async checkpoint(idempotencyKey: string, holder: string, ids: Partial<ProvisionIds>): Promise<void> {
		const values: Row = { updatedAt: this.now() };
		for (const [key, value] of Object.entries(ids)) {
			if (value) values[key] = value;
		}
		await this.sql.update(RESULT, values, { idempotencyKey, claimedBy: holder });
	}

	/** Ends a failed attempt: the row stays for a retry, which resumes from the ids kept. */
	async fail(idempotencyKey: string, holder: string, errorCode: string): Promise<void> {
		await this.sql.update(
			RESULT,
			{ status: 'failed', errorCode: errorCode.slice(0, 64), claimedBy: null, claimedUntil: null, updatedAt: this.now() },
			{ idempotencyKey, claimedBy: holder }
		);
	}

	/** Records a creation another attempt finished (the links exist): heals a row that missed it. */
	async markCreated(idempotencyKey: string, ids: ProvisionIds): Promise<void> {
		await this.sql.update(
			RESULT,
			{
				...ids,
				status: 'created',
				errorCode: null,
				claimedBy: null,
				claimedUntil: null,
				completionState: 'pending',
				completionNextAt: this.now(),
				updatedAt: this.now()
			},
			{ idempotencyKey }
		);
	}

	/** The id of the `Ever_Connect` catalog row (`integration`), or `null`. */
	async catalogId(): Promise<string | null> {
		const catalog = await this.sql.one('integration', { name: LINK_INTEGRATION_NAME });
		return catalog ? String(catalog['id']) : null;
	}

	/**
	 * Inside the transaction that writes the workspace's links: Gauzy's own record of the organization
	 * link (an `integration_tenant` row named `Ever_Connect` with its settings), the audit row, and this
	 * creation marked `created` with its ids, its completion report due now.
	 *
	 * @returns The id of the `integration_tenant` row.
	 */
	async writeCreated(
		tx: ProvisionTx,
		input: {
			idempotencyKey: string;
			ids: ProvisionIds;
			catalogId: string | null;
			settings: Record<string, string>;
			audit: { action: string; actorUserId: string; details: Record<string, string | number> };
		}
	): Promise<string> {
		const { productTenantId: tenantId, productOrgId: organizationId } = input.ids;
		const at = this.now();
		const integrationTenantId = randomUUID();
		await this.insertIn(tx, 'integration_tenant', {
			id: integrationTenantId,
			tenantId,
			organizationId,
			name: LINK_INTEGRATION_NAME,
			integrationId: input.catalogId,
			isActive: true,
			isArchived: false
		});
		for (const [settingsName, settingsValue] of Object.entries(input.settings)) {
			await this.insertIn(tx, 'integration_setting', {
				id: randomUUID(),
				tenantId,
				organizationId,
				integrationId: integrationTenantId,
				settingsName,
				settingsValue,
				isActive: true,
				isArchived: false
			});
		}
		await this.insertIn(tx, 'ever_connect_audit', {
			id: randomUUID(),
			at,
			tenantId,
			organizationId,
			actorUserId: input.audit.actorUserId,
			actorLabel: 'user',
			action: input.audit.action,
			integration: null,
			details: JSON.stringify(input.audit.details)
		});
		const values: Row = {
			...input.ids,
			status: 'created',
			integrationTenantId,
			errorCode: null,
			claimedBy: null,
			claimedUntil: null,
			completionState: 'pending',
			completionAttempts: 0,
			completionNextAt: at,
			updatedAt: at
		};
		const columns = Object.keys(values);
		const q = (c: string) => this.sql.q(c);
		await tx.query(
			`UPDATE ${q(RESULT)} SET ${columns.map((c, i) => `${q(c)} = ${this.sql.ph(i + 1)}`).join(', ')} WHERE ${q('idempotencyKey')} = ${this.sql.ph(columns.length + 1)}`,
			[...columns.map((c) => this.bindable(values[c])), input.idempotencyKey]
		);
		return integrationTenantId;
	}

	// ── Completion reports ────────────────────────────────────────────────────

	/** Creations whose completion report is due (oldest first). */
	async dueCompletions(limit: number): Promise<ProvisionResultRecord[]> {
		const q = (c: string) => this.sql.q(c);
		const { rows } = await this.sql.run(
			`SELECT * FROM ${q(RESULT)} WHERE ${q('status')} = ${this.sql.ph(1)} AND ${q('completionState')} = ${this.sql.ph(2)} ` +
				`AND (${q('completionNextAt')} IS NULL OR ${q('completionNextAt')} <= ${this.sql.ph(3)}) ORDER BY ${q('createdAt')} ASC LIMIT ${Math.max(1, Math.floor(limit))}`,
			['created', 'pending', this.now()]
		);
		return rows.map(toResult);
	}

	/**
	 * Updates a completion report only while it is still in the state the caller read (`attempts`), so
	 * two API processes never both count one attempt. Answers whether it did.
	 */
	async updateCompletion(idempotencyKey: string, attempts: number, values: Partial<ProvisionResultRecord>): Promise<boolean> {
		const changed = await this.sql.update(
			RESULT,
			{ ...values, updatedAt: this.now() } as Row,
			{ idempotencyKey, completionAttempts: attempts, completionState: 'pending' }
		);
		return changed > 0;
	}

	/** Adds settings to a link's `integration_tenant` row (a setting that exists is updated). */
	async addLinkSettings(owner: { tenantId: string; organizationId: string }, integrationTenantId: string, settings: Record<string, string>): Promise<void> {
		for (const [settingsName, settingsValue] of Object.entries(settings)) {
			const changed = await this.sql.update('integration_setting', { settingsValue }, { integrationId: integrationTenantId, settingsName });
			if (changed === 0) {
				await this.sql.insert('integration_setting', {
					id: randomUUID(),
					tenantId: owner.tenantId,
					organizationId: owner.organizationId,
					integrationId: integrationTenantId,
					settingsName,
					settingsValue,
					isActive: true,
					isArchived: false
				});
			}
		}
	}

	private async insertIn(tx: ProvisionTx, table: string, values: Row): Promise<void> {
		const columns = Object.keys(values);
		await tx.query(
			`INSERT INTO ${this.sql.q(table)} (${columns.map((c) => this.sql.q(c)).join(', ')}) VALUES (${columns.map((_, i) => this.sql.ph(i + 1)).join(', ')})`,
			columns.map((c) => this.bindable(values[c]))
		);
	}

	/** A value as every driver binds it: booleans become 1/0 except on Postgres. */
	private bindable(value: unknown): unknown {
		if (typeof value === 'boolean' && this.sql.dialect !== 'postgres') {
			return value ? 1 : 0;
		}
		return value === undefined ? null : value;
	}
}
