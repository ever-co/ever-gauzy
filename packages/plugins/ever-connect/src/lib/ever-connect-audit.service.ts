import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EVER_CONNECT_CLOCK } from './ever-connect.constants';
import { EverConnectSql, num, str } from './ever-connect-sql';

/** What the audit records. */
export const AUDIT_ACTIONS = Object.freeze([
	'instance.connect',
	'instance.disconnect',
	'instance.rotate_key',
	'link.create',
	'link.remove',
	'link.purge',
	'integration.enable',
	'integration.disable',
	'consent.grant',
	'consent.revoke',
	'entitlement.refresh',
	'policy.change'
] as const);
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * The only keys `details` may hold: ids, states, reasons and counts. Anything else (a code, a token,
 * a key, an address, an e-mail, an IP address, a user agent) is refused.
 */
export const AUDIT_DETAIL_KEYS = Object.freeze([
	'platform_instance_id',
	'kid',
	'link_id',
	'ever_org_id',
	'consent_id',
	'state',
	'from',
	'to',
	'reason',
	'source',
	'status',
	'seq',
	'subject',
	'allowed',
	'event_id',
	'remote'
] as const);

/** Who acted, without personal data. */
export type ActorLabel = 'user' | 'operator' | 'platform' | 'env:EVER_CONNECT_CODE' | 'system';

export interface AuditEntry {
	action: AuditAction;
	actorUserId?: string | null;
	actorLabel: ActorLabel;
	tenantId?: string | null;
	organizationId?: string | null;
	integration?: string | null;
	details?: Record<string, string | number | boolean | null>;
}

export interface AuditRow {
	id: string;
	at: string;
	action: string;
	actor_label: string;
	actor_user_id: string | null;
	integration: string | null;
	details: Record<string, unknown>;
	scope: 'instance' | 'organization';
}

/** A `details` key outside {@link AUDIT_DETAIL_KEYS}, or an action outside {@link AUDIT_ACTIONS}. */
export class AuditEntryRefusedError extends Error {
	constructor(reason: string) {
		super(`Audit entry refused: ${reason}`);
		this.name = 'AuditEntryRefusedError';
	}
}

/** The highest page of the audit that can be read (a larger number reads that page). */
export const MAX_AUDIT_PAGE = 10_000;

/**
 * The audit of the Ever Platform connection (`ever_connect_audit`). It only adds rows; no row is
 * ever changed. Rows are removed only with the Gauzy tenant or organization they belong to, once that
 * was deleted ({@link purge}); the installation keeps one row saying a deleted organization's link was
 * removed, without its ids.
 */
@Injectable()
export class EverConnectAuditService {
	private readonly sql: EverConnectSql;
	private readonly now: () => number;

	constructor(dataSource: DataSource, @Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }) {
		this.sql = new EverConnectSql(dataSource);
		this.now = clock?.now ?? (() => Date.now());
	}

	/** Checks an entry without writing it (throws {@link AuditEntryRefusedError}). */
	static check(entry: AuditEntry): void {
		if (!(AUDIT_ACTIONS as ReadonlyArray<string>).includes(entry.action)) {
			throw new AuditEntryRefusedError('unknown action');
		}
		for (const [key, value] of Object.entries(entry.details ?? {})) {
			if (!(AUDIT_DETAIL_KEYS as ReadonlyArray<string>).includes(key)) {
				throw new AuditEntryRefusedError(`details key "${key}" is not allowed`);
			}
			if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
				throw new AuditEntryRefusedError(`details "${key}" is not a plain value`);
			}
			if (typeof value === 'string' && (value.length > 128 || /@|:\/\//.test(value))) {
				throw new AuditEntryRefusedError(`details "${key}" looks like an address`);
			}
		}
	}

	async record(entry: AuditEntry): Promise<void> {
		EverConnectAuditService.check(entry);
		await this.sql.insert('ever_connect_audit', {
			id: randomUUID(),
			at: this.now(),
			tenantId: entry.tenantId ?? null,
			organizationId: entry.organizationId ?? null,
			actorUserId: entry.actorUserId ?? null,
			actorLabel: entry.actorLabel,
			action: entry.action,
			integration: entry.integration ?? null,
			details: entry.details ? JSON.stringify(entry.details) : null
		});
	}

	/**
	 * A page of the audit of one organization, newest first. The installation's own rows (connect,
	 * disconnect, policy, installation-wide integrations) are included only for the operator.
	 */
	async list(scope: {
		tenantId: string;
		organizationId: string;
		includeInstance: boolean;
		integration?: string | null;
		page: number;
		limit: number;
	}): Promise<{ items: AuditRow[]; total: number }> {
		const q = (c: string) => this.sql.q(c);
		const params: unknown[] = [scope.tenantId, scope.organizationId];
		let where = `(${q('tenantId')} = ${this.sql.ph(1)} AND ${q('organizationId')} = ${this.sql.ph(2)})`;
		if (scope.includeInstance) {
			where = `(${where} OR (${q('tenantId')} IS NULL AND ${q('organizationId')} IS NULL))`;
		}
		if (scope.integration) {
			params.push(scope.integration);
			where += ` AND ${q('integration')} = ${this.sql.ph(params.length)}`;
		}
		const limit = Math.min(Math.max(1, Math.floor(scope.limit)), 100);
		const page = Math.min(Math.max(1, Math.floor(scope.page) || 1), MAX_AUDIT_PAGE);
		const offset = (page - 1) * limit;
		const total = await this.sql.run(
			`SELECT COUNT(*) AS ${q('n')} FROM ${q('ever_connect_audit')} WHERE ${where}`,
			params
		);
		const rows = await this.sql.run(
			`SELECT * FROM ${q('ever_connect_audit')} WHERE ${where} ORDER BY ${q('at')} DESC, ${q('id')} DESC LIMIT ${limit} OFFSET ${offset}`,
			params
		);
		return {
			total: num(total.rows[0]?.['n']) ?? 0,
			items: rows.rows.map((row) => ({
				id: String(row['id']),
				at: new Date(num(row['at']) ?? 0).toISOString(),
				action: String(row['action']),
				actor_label: String(row['actorLabel']),
				actor_user_id: str(row['actorUserId']),
				integration: str(row['integration']),
				details: row['details'] ? (JSON.parse(String(row['details'])) as Record<string, unknown>) : {},
				scope: row['tenantId'] ? 'organization' : 'instance'
			}))
		};
	}

	/**
	 * Removes the rows of a deleted Gauzy organization (or of every organization of a deleted tenant,
	 * without `organizationId`). Returns the number of rows removed.
	 */
	async purge(owner: { tenantId: string; organizationId?: string | null }): Promise<number> {
		const q = (c: string) => this.sql.q(c);
		const params: unknown[] = [owner.tenantId];
		let where = `${q('tenantId')} = ${this.sql.ph(1)}`;
		if (owner.organizationId) {
			params.push(owner.organizationId);
			where += ` AND ${q('organizationId')} = ${this.sql.ph(2)}`;
		}
		const { affected } = await this.sql.run(`DELETE FROM ${q('ever_connect_audit')} WHERE ${where}`, params);
		return affected;
	}
}
