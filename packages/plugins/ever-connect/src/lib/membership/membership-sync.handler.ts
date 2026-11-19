import { Inject, Injectable, Logger, Optional, Type } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EverConnectAuditService } from '../ever-connect-audit.service';
import { EverConnectSql, Row, str } from '../ever-connect-sql';
import { EVER_CONNECT_ENV, ULID_SHAPE } from '../ever-connect.constants';
import { EverConnectStore, LinkRecord } from '../ever-connect.store';
import type { EventEnvelope } from '../sdk';
import {
	EVER_ROLE_TO_GAUZY_ROLE,
	EverRole,
	GAUZY_ADMIN,
	GAUZY_SUPER_ADMIN,
	isAfter,
	isEverRole,
	isMembershipSyncEnabled,
	MembershipChange,
	membershipChangeOf,
	MembershipEventData,
	MembershipPosition,
	parseMembershipData,
	sameIssuer
} from './membership-sync.config';

type Env = Record<string, string | undefined>;

/** The audit action of one applied membership change; its rows are also the sync's memory (see below). */
export const MEMBERSHIP_AUDIT_ACTION = 'membership.sync';

/**
 * What one event did, a machine code (logged and audited, never with an id or a name).
 *
 * Applied, and audited: `added` (the user joined the linked organization), `removed` (left it), `role_granted`,
 * `role_revoked`, `unchanged`, `kept_for_other_link` (another linked organization of the tenant still makes them an
 * administrator), `changed_here` (the role was changed in Gauzy since the sync granted it: left as it is),
 * `super_admin_kept`, `not_a_member`, `account_missing`, `role_missing` (the role to set does not exist in the
 * tenant: nothing changed, tried again on the next change).
 *
 * Not applied, and not audited: `switched_off`, `not_a_membership_event`, `malformed`, `role_unknown`,
 * `link_unknown`, `person_unknown` (no Gauzy user of the tenant is linked to that Ever ID, or two are),
 * `person_mismatch` (Ever Platform's person link names another user), `duplicate`, `stale`.
 */
export type MembershipSyncOutcome =
	| 'added'
	| 'removed'
	| 'role_granted'
	| 'role_revoked'
	| 'unchanged'
	| 'kept_for_other_link'
	| 'changed_here'
	| 'super_admin_kept'
	| 'not_a_member'
	| 'account_missing'
	| 'role_missing'
	| 'switched_off'
	| 'not_a_membership_event'
	| 'malformed'
	| 'role_unknown'
	| 'link_unknown'
	| 'person_unknown'
	| 'person_mismatch'
	| 'duplicate'
	| 'stale';

/** The last change applied for a user in one organization, read back from the audit. */
interface SyncState extends MembershipPosition {
	/** The sync made (or keeps) the user an `ADMIN` for this organization's link. */
	held: boolean;
	/** The role id the user had before the sync made them `ADMIN` (`null`: none), given back on a demotion. */
	restore: string | null;
	/** The grant it holds: the id of the event that made the user `ADMIN` (see {@link Grant}). */
	grant: string | null;
}

/**
 * The sync's latest grant of `ADMIN` to a user in a tenant (the event that made them `ADMIN` while they were not one),
 * and the role it replaced. Only the organizations holding THIS grant keep the `ADMIN`: a hold on an older grant is
 * void, since the user stopped being `ADMIN` in between (a role changed in Gauzy) and was granted it again.
 */
interface Grant {
	grant: string;
	restore: string | null;
}

/** What the role step did. */
interface RoleStep {
	outcome: MembershipSyncOutcome;
	held: boolean;
	restore: string | null;
	grant: string | null;
	from: string | null;
	to: string | null;
}

/** The user, their role and the roles of their tenant, as one change reads them. */
interface Account {
	tenantId: string;
	userId: string;
	roleId: string | null;
	role: string | null;
	roles: Map<string, string>;
}

/**
 * How many of the sync's audit rows of one user in one organization are read back to find the last change applied.
 * Rows are written in the order changes are applied, so the last one is among the newest; a few more cover rows
 * written in the same millisecond.
 */
const STATE_ROWS = 20;

/** No hold on a grant. */
const NO_HOLD = Object.freeze({ held: false, restore: null, grant: null });

/** The advisory lock (Postgres) that runs one change at a time across API processes. */
const LOCK = 'ever-connect:membership-sync';

/**
 * Applies the membership changes Ever Platform sends on the installation's feed
 * (`ever.registry.membership.created|role_changed|removed`: the tenant link, the person's Ever ID, the Gauzy user
 * when Ever Platform has a person link for them, and the Ever role) to the Gauzy organization that link is for.
 * Registered only with `EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED=true` ({@link membershipSyncProviders}); off, the feed
 * acknowledges these events and nothing changes.
 *
 * - **The person** is the one Gauzy user of the link's tenant linked to that Ever ID (the Ever ID sign-in plugin's
 *   `zitadel_account`, written only after the person proved both sides; an issuer with or without a trailing slash
 *   is the same). When the event names a Gauzy user too, it must be that one. No such user, or two: nothing changes.
 *   **No user is ever created.**
 * - **The organization** is the one of the live tenant link with that id (status `linked`); none: nothing changes.
 * - **The role** maps through {@link EVER_ROLE_TO_GAUZY_ROLE}: `owner` and `admin` make the user `ADMIN`, `member`
 *   gives back the role an `ADMIN` granted by the sync replaced; any other role changes nothing.
 * - **The change.** `created`: the user joins the organization (an inactive membership is made active again, else
 *   one is added) and gets the role. `role_changed`: the role, for an active member only (`not_a_member`
 *   otherwise). `removed`: an `ADMIN` the sync granted goes back to the role before it, and the membership of the
 *   organization is made inactive. Nothing is deleted: not the user, not the membership row, not anything they made.
 * - **What the sync never touches:** a `SUPER_ADMIN` (the tenant owner), and an `ADMIN` given in Gauzy: a demotion
 *   or removal takes away only an `ADMIN` the sync itself granted, and only while the user still has it. When
 *   another linked organization of the same tenant still says the person is an owner or admin, the `ADMIN` stays.
 *   Each grant is remembered with the role it replaced; an organization holds the latest grant only, so the role
 *   given back is always the one the current `ADMIN` replaced.
 * - **Order and repeats.** Each applied change is one `membership.sync` audit row (ids, roles and the outcome
 *   only), which is also the sync's memory: the same event again does nothing (`duplicate`), and an event older
 *   than the last one applied for the user in that organization (by `occurred_at`, then by its id, a ULID) is
 *   skipped (`stale`).
 * - **All or nothing.** The memory is read, the user and the membership are changed and the audit row is written in
 *   one transaction: a change is never kept without its row (which would make a granted `ADMIN` look like one given
 *   in Gauzy), nor a row without its change.
 *
 * A failure of the database throws (the transaction is rolled back), so the feed reads the event again.
 */
@Injectable()
export class MembershipSyncHandler {
	private readonly logger = new Logger('EverConnect');
	private readonly sql: EverConnectSql;
	private readonly env: Env;

	constructor(
		dataSource: DataSource,
		private readonly store: EverConnectStore,
		private readonly audit: EverConnectAuditService,
		@Optional() @Inject(EVER_CONNECT_ENV) env?: Env
	) {
		this.sql = new EverConnectSql(dataSource);
		this.env = env ?? process.env;
	}

	/** Whether the feed event type is a membership change. */
	handles(type: string): boolean {
		return membershipChangeOf(type) !== null;
	}

	/** Applies one event of the feed; answers what it did. */
	async apply(event: EventEnvelope): Promise<MembershipSyncOutcome> {
		if (!isMembershipSyncEnabled(this.env)) {
			return 'switched_off';
		}
		const change = membershipChangeOf(String(event?.type ?? ''));
		if (!change) {
			return 'not_a_membership_event';
		}
		const data = parseMembershipData(event.data);
		const eventId = typeof event.id === 'string' ? event.id.toUpperCase() : '';
		const occurredAt = occurredAtOf(event);
		// Every envelope carries its time; one without it could not be ordered against the changes already applied.
		if (!data || !ULID_SHAPE.test(eventId) || occurredAt === null) {
			return this.done('malformed');
		}
		const everRole = data.role;
		if (!isEverRole(everRole)) {
			return this.done('role_unknown');
		}
		const link = await this.store.linkById(data.linkId);
		if (!link || link.status !== 'linked') {
			return this.done('link_unknown');
		}
		const person = await this.personOf(link.tenantId, data);
		if (person === 'person_unknown' || person === 'person_mismatch') {
			return this.done(person);
		}

		const position: MembershipPosition = { eventId, occurredAt };
		const outcome = await this.sql.inTransaction(LOCK, async (tx) => {
			// Read again under the lock: a link unlinked while this change waited for it changes nothing, and an
			// organization unlinked meanwhile no longer keeps the ADMIN of its grant. On Postgres and MySQL the rows are
			// also locked until this change commits, so an unlink made in Gauzy meanwhile waits for it (and one that
			// committed first is read here): the change never runs on a link state that is no longer true.
			const forUpdate = tx.dialect === 'sqlite' ? '' : ' FOR UPDATE';
			const { rows: linkRows } = await tx.run(
				`SELECT ${tx.q('linkId')}, ${tx.q('organizationId')}, ${tx.q('status')} FROM ${tx.q('ever_connect_link')} ` +
					`WHERE ${tx.q('tenantId')} = ${tx.ph(1)}${forUpdate}`,
				[link.tenantId]
			);
			const links = linkRows.map((row) => ({
				linkId: String(row['linkId']),
				organizationId: String(row['organizationId']),
				status: String(row['status'])
			}));
			if (!links.some((row) => row.linkId === link.linkId && row.status === 'linked')) {
				return 'link_unknown' as const;
			}
			const others = links
				.filter((row) => row.status !== 'unlinked' && row.organizationId !== link.organizationId)
				.map((row) => row.organizationId);
			const last = await this.stateIn(tx, link.tenantId, link.organizationId, person);
			if (last && last.eventId === position.eventId) {
				return 'duplicate' as const;
			}
			if (last && !isAfter(position, last)) {
				return 'stale' as const;
			}
			const grant = await this.latestGrant(tx, link.tenantId, person);
			const other = grant ? await this.heldElsewhere(tx, link.tenantId, others, person, grant) : false;
			const step = await this.change(tx, change, everRole, link, person, position, last, grant, other);
			await this.audit.record(
				{
					action: MEMBERSHIP_AUDIT_ACTION,
					actorLabel: 'platform',
					tenantId: link.tenantId,
					organizationId: link.organizationId,
					details: {
						event_id: position.eventId,
						occurred_at: position.occurredAt,
						link_id: link.linkId,
						op: change,
						role: everRole,
						user_id: person,
						result: step.outcome,
						from: auditable(step.from),
						to: auditable(step.to),
						held: step.held,
						restore: step.restore,
						grant: step.grant
					}
				},
				tx
			);
			return step.outcome;
		});
		return this.done(outcome);
	}

	/**
	 * The one Gauzy user of `tenantId` linked to the event's Ever ID, `person_unknown` when there is none (or two),
	 * `person_mismatch` when the event names another user.
	 */
	private async personOf(
		tenantId: string,
		data: MembershipEventData
	): Promise<string | 'person_unknown' | 'person_mismatch'> {
		const q = (name: string) => this.sql.q(name);
		const { rows } = await this.sql.run(
			`SELECT a.${q('userId')} AS ${q('userId')}, a.${q('issuer')} AS ${q('issuer')} FROM ${q('zitadel_account')} a ` +
				`INNER JOIN ${q('user')} u ON u.${q('id')} = a.${q('userId')} ` +
				`WHERE a.${q('subject')} = ${this.sql.ph(1)} AND u.${q('tenantId')} = ${this.sql.ph(2)} ` +
				`AND a.${q('deletedAt')} IS NULL AND u.${q('deletedAt')} IS NULL`,
			[data.subject, tenantId]
		);
		const wanted = sameIssuer(data.issuer);
		const users = new Set(
			rows.filter((row) => sameIssuer(String(row['issuer'] ?? '')) === wanted).map((row) => String(row['userId']))
		);
		if (users.size !== 1) {
			return 'person_unknown';
		}
		const [userId] = [...users];
		return data.userRef !== null && data.userRef !== userId ? 'person_mismatch' : userId;
	}

	/** The last change applied for the user in one organization, from the sync's own audit rows; `null`: none. */
	private async stateIn(
		tx: EverConnectSql,
		tenantId: string,
		organizationId: string,
		userId: string
	): Promise<SyncState | null> {
		const q = (name: string) => tx.q(name);
		const { rows } = await tx.run(
			`SELECT ${q('details')} FROM ${q('ever_connect_audit')} WHERE ${q('tenantId')} = ${tx.ph(1)} ` +
				`AND ${q('organizationId')} = ${tx.ph(2)} AND ${q('action')} = ${tx.ph(3)} AND ${q('details')} LIKE ${tx.ph(4)} ` +
				`ORDER BY ${q('at')} DESC, ${q('id')} DESC LIMIT ${STATE_ROWS}`,
			[tenantId, organizationId, MEMBERSHIP_AUDIT_ACTION, `%"user_id":${JSON.stringify(userId)}%`]
		);
		let last: SyncState | null = null;
		for (const row of rows) {
			const state = stateOf(row, userId);
			if (state && (!last || isAfter(state, last))) {
				last = state;
			}
		}
		return last;
	}

	/**
	 * The sync's latest grant of `ADMIN` to the user in the tenant (any organization), or `null`. Every row that holds a
	 * grant names the latest one (a new grant voids the older ones), so the newest holding row tells it.
	 */
	private async latestGrant(tx: EverConnectSql, tenantId: string, userId: string): Promise<Grant | null> {
		const q = (name: string) => tx.q(name);
		const { rows } = await tx.run(
			`SELECT ${q('details')} FROM ${q('ever_connect_audit')} WHERE ${q('tenantId')} = ${tx.ph(1)} ` +
				`AND ${q('action')} = ${tx.ph(2)} AND ${q('details')} LIKE ${tx.ph(3)} AND ${q('details')} LIKE ${tx.ph(4)} ` +
				`ORDER BY ${q('at')} DESC, ${q('id')} DESC LIMIT 1`,
			[tenantId, MEMBERSHIP_AUDIT_ACTION, `%"user_id":${JSON.stringify(userId)}%`, '%"held":true%']
		);
		const state = rows[0] ? stateOf(rows[0], userId) : null;
		return state?.held && state.grant ? { grant: state.grant, restore: state.restore } : null;
	}

	/**
	 * Whether another live link of the same tenant holds `grant`: its organization's own last change (read however
	 * long ago it was made) keeps the user `ADMIN` under that grant.
	 */
	private async heldElsewhere(
		tx: EverConnectSql,
		tenantId: string,
		others: ReadonlyArray<string>,
		userId: string,
		grant: Grant
	): Promise<boolean> {
		for (const organizationId of new Set(others)) {
			const state = await this.stateIn(tx, tenantId, organizationId, userId);
			if (state?.held && state.grant === grant.grant) {
				return true;
			}
		}
		return false;
	}

	/** Applies the change to the user and the organization. */
	private async change(
		tx: EverConnectSql,
		change: MembershipChange,
		everRole: EverRole,
		link: LinkRecord,
		userId: string,
		position: MembershipPosition,
		last: SyncState | null,
		grant: Grant | null,
		other: boolean
	): Promise<RoleStep> {
		// The hold this organization has now: only one on the latest grant counts.
		const holds = !!(last?.held && grant && last.grant === grant.grant);
		const kept = {
			held: holds,
			restore: holds ? (grant?.restore ?? null) : null,
			grant: holds ? last!.grant : null
		};
		const account = await this.accountOf(tx, link.tenantId, userId);
		if (!account) {
			return { outcome: 'account_missing', ...kept, from: null, to: null };
		}
		if (account.role === GAUZY_SUPER_ADMIN) {
			// The tenant owner: never changed, never removed.
			return { ...NO_HOLD, outcome: 'super_admin_kept', from: account.role, to: account.role };
		}
		const target = EVER_ROLE_TO_GAUZY_ROLE[everRole];
		const membership = await this.membershipOf(tx, link, userId);
		switch (change) {
			case 'created': {
				let added = false;
				if (!membership.active) {
					await this.join(tx, link, userId, membership.inactiveId);
					added = true;
				}
				const step = await this.role(tx, target, account, position, holds, grant, other);
				return added ? { ...step, outcome: 'added' } : step;
			}
			case 'role_changed': {
				if (!membership.active) {
					return { outcome: 'not_a_member', ...kept, from: account.role, to: account.role };
				}
				return this.role(tx, target, account, position, holds, grant, other);
			}
			default: {
				const step = await this.role(tx, null, account, position, holds, grant, other);
				if (membership.active) {
					await this.leave(tx, link, userId);
					return { ...step, outcome: 'removed' };
				}
				return step.outcome === 'unchanged' ? { ...step, outcome: 'not_a_member' } : step;
			}
		}
	}

	/**
	 * The role step: `ADMIN` granted (when the user is not one), or an `ADMIN` the sync granted given back. Every write
	 * is a compare-and-set on the role the user has now, so a role changed in Gauzy meanwhile is never overwritten.
	 *
	 * @param holds - This organization holds the latest grant.
	 * @param grant - The sync's latest grant of `ADMIN` to the user in the tenant.
	 * @param other - Another live linked organization of the tenant holds that grant.
	 */
	private async role(
		tx: EverConnectSql,
		target: typeof GAUZY_ADMIN | null,
		account: Account,
		position: MembershipPosition,
		holds: boolean,
		grant: Grant | null,
		other: boolean
	): Promise<RoleStep> {
		const same = { from: account.role, to: account.role };
		if (target === GAUZY_ADMIN) {
			if (account.role === GAUZY_ADMIN) {
				// Granted by the sync (for this organization or another one still holding it): this one holds it too.
				if (grant && (holds || other)) {
					return { outcome: 'unchanged', held: true, restore: grant.restore, grant: grant.grant, ...same };
				}
				// An ADMIN given in Gauzy: not the sync's to take away later.
				return { ...NO_HOLD, outcome: 'unchanged', ...same };
			}
			const adminId = roleIdOf(account.roles, GAUZY_ADMIN);
			if (!adminId) {
				return { ...NO_HOLD, outcome: 'role_missing', ...same };
			}
			if (!(await this.setRole(tx, account, adminId))) {
				return { ...NO_HOLD, outcome: 'changed_here', ...same };
			}
			// A new grant: holds on any earlier one are void from now on.
			return {
				outcome: 'role_granted',
				held: true,
				restore: account.roleId,
				grant: position.eventId,
				from: account.role,
				to: GAUZY_ADMIN
			};
		}
		// No role from Ever: take back an ADMIN the sync granted, and nothing else.
		if (!holds || !grant) {
			return { ...NO_HOLD, outcome: 'unchanged', ...same };
		}
		if (other) {
			return { ...NO_HOLD, outcome: 'kept_for_other_link', ...same };
		}
		if (account.role !== GAUZY_ADMIN) {
			return { ...NO_HOLD, outcome: 'changed_here', ...same };
		}
		const restore = grant.restore;
		if (restore !== null && !account.roles.has(restore)) {
			// The role to give back no longer exists: left as it is, and tried again on the next change.
			return { outcome: 'role_missing', held: true, restore, grant: grant.grant, ...same };
		}
		if (!(await this.setRole(tx, account, restore))) {
			return { ...NO_HOLD, outcome: 'changed_here', ...same };
		}
		return {
			...NO_HOLD,
			outcome: 'role_revoked',
			from: account.role,
			to: restore === null ? null : (account.roles.get(restore) ?? null)
		};
	}

	/** The user (not deleted) of the tenant with their role, and the tenant's roles; `null` when there is no user. */
	private async accountOf(tx: EverConnectSql, tenantId: string, userId: string): Promise<Account | null> {
		const user = (await tx.select('user', { id: userId, tenantId })).find((row) => !row['deletedAt']);
		if (!user) {
			return null;
		}
		const roles = new Map<string, string>();
		for (const row of await tx.select('role', { tenantId })) {
			if (!row['deletedAt'] && row['id'] && row['name']) roles.set(String(row['id']), String(row['name']));
		}
		const roleId = str(user['roleId']);
		return { tenantId, userId, roleId, role: roleId ? (roles.get(roleId) ?? null) : null, roles };
	}

	/** Sets the user's role, only if it is still the one read; answers whether it was set. */
	private async setRole(tx: EverConnectSql, account: Account, roleId: string | null): Promise<boolean> {
		const changed = await tx.update(
			'user',
			{ roleId },
			{ id: account.userId, tenantId: account.tenantId, roleId: account.roleId }
		);
		return changed > 0;
	}

	/** The user's memberships of the organization that are not deleted: whether one is active, else an inactive one. */
	private async membershipOf(
		tx: EverConnectSql,
		link: LinkRecord,
		userId: string
	): Promise<{ active: boolean; inactiveId: string | null }> {
		const rows = (
			await tx.select('user_organization', {
				tenantId: link.tenantId,
				organizationId: link.organizationId,
				userId
			})
		).filter((row) => !row['deletedAt']);
		const active = rows.some((row) => isActiveRow(row));
		const inactive = rows.find((row) => !isActiveRow(row));
		return { active, inactiveId: inactive ? String(inactive['id']) : null };
	}

	/** Makes the user a member of the organization: an inactive membership active again, else a new one. */
	private async join(tx: EverConnectSql, link: LinkRecord, userId: string, inactiveId: string | null): Promise<void> {
		if (inactiveId && (await tx.update('user_organization', { isActive: true }, { id: inactiveId })) > 0) {
			return;
		}
		await tx.insert('user_organization', {
			id: randomUUID(),
			tenantId: link.tenantId,
			organizationId: link.organizationId,
			userId,
			isActive: true,
			isArchived: false
		});
	}

	/** Makes the user's memberships of the organization inactive (the rows stay). */
	private async leave(tx: EverConnectSql, link: LinkRecord, userId: string): Promise<void> {
		await tx.update(
			'user_organization',
			{ isActive: false },
			{ tenantId: link.tenantId, organizationId: link.organizationId, userId, deletedAt: null }
		);
	}

	private done<T extends MembershipSyncOutcome>(outcome: T): T {
		this.logger.log(`Ever Platform membership change: ${outcome}.`);
		return outcome;
	}
}

/**
 * The providers of the membership sync for `EverConnectModule`: the handler with the switch on; otherwise, by
 * default, NONE, so the feed acknowledges membership changes and nothing reads or writes for them.
 */
export function membershipSyncProviders(
	env: Env = process.env,
	warn: (message: string) => void = () => undefined
): Array<Type<unknown>> {
	return isMembershipSyncEnabled(env, warn) ? [MembershipSyncHandler] : [];
}

/** The event's own time (`occurred_at`), when it carries a valid one. */
function occurredAtOf(event: EventEnvelope): number | null {
	const value = (event as { occurred_at?: unknown }).occurred_at;
	if (typeof value !== 'string') return null;
	const at = Date.parse(value);
	return Number.isFinite(at) ? at : null;
}

/** One audit row of the sync for `userId`, as a state; `null` when it is not one. */
function stateOf(row: Row, userId: string): SyncState | null {
	let details: Record<string, unknown>;
	try {
		details = JSON.parse(String(row['details'] ?? '')) as Record<string, unknown>;
	} catch {
		return null;
	}
	if (!details || details['user_id'] !== userId || typeof details['event_id'] !== 'string') {
		return null;
	}
	const occurredAt = details['occurred_at'];
	const restore = details['restore'];
	const grant = details['grant'];
	return {
		eventId: String(details['event_id']).toUpperCase(),
		occurredAt: typeof occurredAt === 'number' && Number.isFinite(occurredAt) ? occurredAt : null,
		held: details['held'] === true,
		restore: typeof restore === 'string' && restore ? restore : null,
		grant: typeof grant === 'string' && grant ? grant : null
	};
}

/** The id of the tenant's role named `name`, or `null`. */
function roleIdOf(roles: Map<string, string>, name: string): string | null {
	for (const [id, roleName] of roles) {
		if (roleName === name) return id;
	}
	return null;
}

/** A `user_organization` row that is active (`isActive` true, or not set). */
function isActiveRow(row: Row): boolean {
	const value = row['isActive'];
	return value === null || value === undefined || value === true || value === 1 || value === '1' || value === 't';
}

/** A role name as the audit takes it (ids, states and names only), else `null`. */
function auditable(name: string | null): string | null {
	return name !== null && name.length <= 128 && !/@|:\/\//.test(name) ? name : null;
}
