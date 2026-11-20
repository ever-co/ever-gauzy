import { Inject, Injectable, Logger, Optional, Type } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EverConnectAuditService } from '../ever-connect-audit.service';
import { EverConnectSql, num, Row, str } from '../ever-connect-sql';
import { EVER_CONNECT_CLOCK, EVER_CONNECT_ENV, ULID_SHAPE } from '../ever-connect.constants';
import { EverConnectStore, LinkRecord } from '../ever-connect.store';
import { EverPlatformClient, ProblemError } from '../sdk';
import type { EventEnvelope } from '../sdk';
import {
	EVER_ROLE_TO_GAUZY_ROLE,
	EverRole,
	GAUZY_ADMIN,
	GAUZY_EMPLOYEE,
	GAUZY_SUPER_ADMIN,
	GAUZY_VIEWER,
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
import {
	CurrentMember,
	identityKey,
	ListedMembers,
	MEMBERSHIP_RESYNC_MAX_PAGES,
	parseCurrentMember,
	positionAfter,
	readLinkMembershipsPage
} from './membership-resync';

type Env = Record<string, string | undefined>;

/** The audit action of one applied membership change; its rows are also the sync's memory (see below). */
export const MEMBERSHIP_AUDIT_ACTION = 'membership.sync';

/**
 * What one event did, a machine code (logged and audited, never with an id or a name).
 *
 * Applied, and audited: `added` (the user joined the linked organization), `removed` (left it), `role_granted`,
 * `role_revoked`, `unchanged`, `kept_for_other_link` (another linked organization of the tenant still makes them an
 * administrator), `changed_here` (the role was changed in Gauzy since the sync granted it: left as it is),
 * `super_admin_kept`, `not_a_member`, `account_missing`, `role_missing` (the tenant has no ADMIN role to grant; the
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

/** What one membership resync did, a machine code. */
export type MembershipResyncOutcome = 'switched_off' | 'done' | 'module_disabled' | 'failed' | 'lease_lost';

/** What reading the list of one link did. */
type LinkResync = 'read' | 'link_unknown' | 'module_disabled' | 'failed' | 'lease_lost';

/**
 * Where a change takes its place among the changes applied for the user in the organization (`last`, read under the
 * lock): the change and its position, or an outcome that ends it there with nothing written.
 */
type Decide = (
	last: SyncState | null
) => { change: MembershipChange; position: MembershipPosition } | MembershipSyncOutcome;

/** The last change applied for a user in one organization, read back from the audit. */
interface SyncState extends MembershipPosition {
	/** The change (`created`, `role_changed`, `removed`) and what it did (see {@link MembershipSyncOutcome}). */
	op: string | null;
	result: string | null;
	/** The sync made (or keeps) the user an `ADMIN` for this organization's link. */
	held: boolean;
	/** The role id the user had before the sync made them `ADMIN` (`null`: none), given back on a demotion. */
	restore: string | null;
	/** The grant it holds: the id of the event that made the user `ADMIN` (see {@link Grant}). */
	grant: string | null;
	/** The tenant link the change came through: a hold counts only while that very link is live. */
	linkId: string | null;
	/** The grant the row found void, if any (see {@link RoleStep}). */
	voids: string | null;
	/**
	 * The order in which the sync wrote its rows for the user in the tenant (1, 2, ...): rows written in the same
	 * millisecond keep their order by it, which `at` and the row's random id cannot give.
	 */
	seq: number;
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
	/** The grant this change found void (the role was changed in Gauzy): recorded whatever the outcome. */
	voids?: string | null;
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
 *
 * **Resync** ({@link resync}): after the feed lost events (`410 resync_required`), and once after each start, the
 * current members of each linked Ever organization are read and applied with the same rules (see {@link resync}).
 */
@Injectable()
export class MembershipSyncHandler {
	private readonly logger = new Logger('EverConnect');
	private readonly sql: EverConnectSql;
	private readonly env: Env;
	private readonly now: () => number;
	/** `404 module_disabled` is said once per process. */
	private disabledLogged = false;

	constructor(
		dataSource: DataSource,
		private readonly store: EverConnectStore,
		private readonly audit: EverConnectAuditService,
		@Optional() @Inject(EVER_CONNECT_ENV) env?: Env,
		@Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }
	) {
		this.sql = new EverConnectSql(dataSource);
		this.env = env ?? process.env;
		this.now = clock?.now ?? (() => Date.now());
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
		const position: MembershipPosition = { eventId, occurredAt };
		const { outcome } = await this.applyIn(link, data, everRole, false, (last) => {
			if (last && last.eventId === position.eventId) {
				return 'duplicate';
			}
			if (last && !isAfter(position, last)) {
				return 'stale';
			}
			return { change, position };
		});
		return this.done(outcome);
	}

	/**
	 * Resync: a person the current membership list of a linked Ever organization names as a member, with an Ever role.
	 * Applied with the rules of an event, right after the last change applied for the user in the organization:
	 *
	 * - someone the sync keeps as a member (its last change for them, an event or a resync, left them one) gets the
	 *   role only, as `role_changed` does: made inactive in Gauzy since, they are not made a member again;
	 * - anyone else joins the organization and gets the role, as `created` does.
	 *
	 * Answers what it did (not logged: the resync logs its counts) and the Gauzy user the Ever ID is linked to.
	 */
	async reconcileMember(
		link: LinkRecord,
		member: CurrentMember
	): Promise<{ outcome: MembershipSyncOutcome; userId: string | null }> {
		if (!isMembershipSyncEnabled(this.env)) {
			return { outcome: 'switched_off', userId: null };
		}
		const everRole = member.role;
		if (!isEverRole(everRole)) {
			return { outcome: 'role_unknown', userId: null };
		}
		return this.applyIn(link, { linkId: link.linkId, ...member }, everRole, true, (last) => ({
			change: isKeptMember(last) ? 'role_changed' : 'created',
			position: positionAfter(last)
		}));
	}

	/**
	 * Resync, once the whole list of a linked Ever organization was read: an active member of the Gauzy organization the
	 * list no longer names left the Ever organization, and is removed as `removed` does (an `ADMIN` the sync granted
	 * given back, the membership made inactive; nothing deleted).
	 *
	 * Only someone the sync keeps as a member (its last change for them left them one) is removed: a member who joined
	 * in Gauzy and was never named by Ever Platform is not. And only when one of their Ever IDs comes from an issuer the
	 * list names and none of them is on the list: a user with no such Ever ID here is left as they are. An empty list
	 * removes nobody (an Ever organization always has its owner).
	 */
	async reconcileAbsent(
		link: LinkRecord,
		listed: ListedMembers,
		keep: () => Promise<boolean> = async () => true
	): Promise<MembershipSyncOutcome[] | 'lease_lost'> {
		if (!isMembershipSyncEnabled(this.env) || listed.issuers.size === 0) {
			return [];
		}
		const members = (
			await this.sql.select('user_organization', { tenantId: link.tenantId, organizationId: link.organizationId })
		).filter((row) => !row['deletedAt'] && isUsableRow(row));
		const absent = [...new Set(members.map((row) => String(row['userId'])))].filter(
			(userId) => !listed.userIds.has(userId)
		);
		const outcomes: MembershipSyncOutcome[] = [];
		for (const userId of absent) {
			const everIds = (await this.sql.select('zitadel_account', { userId }))
				.filter((row) => !row['deletedAt'])
				.map((row) => ({
					issuer: sameIssuer(String(row['issuer'] ?? '')),
					subject: String(row['subject'] ?? '')
				}))
				.filter((everId) => listed.issuers.has(everId.issuer));
			if (
				everIds.length === 0 ||
				everIds.some((everId) => listed.identities.has(identityKey(everId.issuer, everId.subject)))
			) {
				continue;
			}
			// Written only while this process holds the lease: another one may apply newer changes meanwhile.
			if (!(await keep())) {
				return 'lease_lost';
			}
			const [everId] = everIds;
			const data: MembershipEventData = { linkId: link.linkId, ...everId, userRef: userId, role: 'member' };
			const { outcome } = await this.applyIn(link, data, 'member', true, (last) =>
				isKeptMember(last) ? { change: 'removed', position: positionAfter(last) } : 'unchanged'
			);
			outcomes.push(outcome);
		}
		return outcomes;
	}

	/**
	 * The membership resync: reads the current members of each linked Ever organization
	 * (`GET /v1/instances/me/tenant-links/{link}/memberships`, 100 a page, every page) and applies them
	 * ({@link reconcileMember}), then, once a link's whole list was read, removes who left ({@link reconcileAbsent}).
	 * Run by the scheduler on the lease holder after `410 resync_required` and once after each start.
	 *
	 * - `404 module_disabled`: Ever Platform sends no membership events, so there is nothing to make up for; said once.
	 * - A link Ever Platform does not know as live (`404`): skipped.
	 * - Any other failure (an answer, a page that is not one, the database): the resync stops with a warning, nobody is
	 *   removed for the link being read, and it runs again at the next `410` or start.
	 * - `keep` renews the lease before each page and each change; when it answers `false` the resync stops there
	 *   (`lease_lost`): nothing more is written by a process that may no longer hold the lease.
	 *
	 * Logged by counts of outcome codes only, never with an id or a name.
	 */
	async resync(
		client: Pick<EverPlatformClient, 'call'>,
		keep: () => Promise<boolean> = async () => true
	): Promise<MembershipResyncOutcome> {
		if (!isMembershipSyncEnabled(this.env)) {
			return 'switched_off';
		}
		const counts = new Map<string, number>();
		const count = (code: string) => counts.set(code, (counts.get(code) ?? 0) + 1);
		try {
			for (const link of await this.store.liveLinks()) {
				if (link.status !== 'linked') continue;
				const outcome = await this.resyncLink(client, link, keep, count);
				if (outcome === 'read') continue;
				if (outcome === 'link_unknown') {
					count('link_unknown');
					continue;
				}
				if (outcome === 'module_disabled') {
					if (!this.disabledLogged) {
						this.disabledLogged = true;
						this.logger.log(
							'Ever Platform sends no membership changes (module_disabled): nothing to resync.'
						);
					}
					return 'module_disabled';
				}
				this.logger.warn(
					`The membership resync stopped (${outcome}; ${summary(counts)}); it runs again at the next resync or start.`
				);
				return outcome;
			}
		} catch (error) {
			this.logger.warn(
				`The membership resync stopped (${failureCode(error)}; ${summary(counts)}); it runs again at the next resync or start.`
			);
			return 'failed';
		}
		// Read again: a later `module_disabled` (the role feed switched off again) is said again.
		this.disabledLogged = false;
		this.logger.log(`Ever Platform membership resync: ${summary(counts)}.`);
		return 'done';
	}

	/** Reads the whole list of one link, applying each page; then removes who left. */
	private async resyncLink(
		client: Pick<EverPlatformClient, 'call'>,
		link: LinkRecord,
		keep: () => Promise<boolean>,
		count: (code: string) => void
	): Promise<LinkResync> {
		const listed = new ListedMembers();
		let complete = true;
		let cursor: string | null = null;
		const cursors = new Set<string>();
		for (let page = 0; ; page += 1) {
			if (page >= MEMBERSHIP_RESYNC_MAX_PAGES) return 'failed';
			if (!(await keep())) return 'lease_lost';
			let answer: Awaited<ReturnType<typeof readLinkMembershipsPage>>;
			try {
				answer = await readLinkMembershipsPage(client, link.linkId, cursor);
			} catch (error) {
				if (error instanceof ProblemError && error.status === 404) {
					return error.code === 'module_disabled' ? 'module_disabled' : 'link_unknown';
				}
				this.logger.warn(`A membership list could not be read (${failureCode(error)}).`);
				return 'failed';
			}
			for (const item of answer.items) {
				const member = parseCurrentMember(item);
				if (!member) {
					// Someone the list names but this cannot read: nobody is removed for this link, so they are not
					// removed by mistake.
					complete = false;
					count('malformed');
					continue;
				}
				// Written only while this process holds the lease: another one may apply newer changes meanwhile.
				if (!(await keep())) return 'lease_lost';
				const { outcome, userId } = await this.reconcileMember(link, member);
				listed.add(member, userId);
				count(outcome);
			}
			if (answer.nextCursor === null) break;
			// A cursor answered before (a cycle): the list would never end.
			if (cursors.has(answer.nextCursor)) return 'failed';
			cursors.add(answer.nextCursor);
			cursor = answer.nextCursor;
		}
		if (complete) {
			const outcomes = await this.reconcileAbsent(link, listed, keep);
			if (outcomes === 'lease_lost') return 'lease_lost';
			for (const outcome of outcomes) {
				count(`absent_${outcome}`);
			}
		}
		return 'read';
	}

	/**
	 * Applies one change to the user and the organization, in one transaction under the lock: the person, the last
	 * change applied for them (from which `decide` places this one), the change and its audit row. A resync
	 * (`resync`) that changes nothing the memory does not already say writes no row.
	 */
	private async applyIn(
		link: LinkRecord,
		data: MembershipEventData,
		everRole: EverRole,
		resync: boolean,
		decide: Decide
	): Promise<{ outcome: MembershipSyncOutcome; userId: string | null }> {
		return this.sql.inTransaction(LOCK, async (tx) => {
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
				return { outcome: 'link_unknown' as const, userId: null };
			}
			const others = links.filter(
				(row) => row.status !== 'unlinked' && row.organizationId !== link.organizationId
			);
			// The person, read (and on Postgres and MySQL locked) in the same transaction: an Ever ID link removed
			// meanwhile in Gauzy is seen here, or waits for this change.
			const person = await this.personOf(tx, link.tenantId, data);
			if (person === 'person_unknown' || person === 'person_mismatch') {
				return { outcome: person, userId: null };
			}
			const last = await this.stateIn(tx, link.tenantId, link.organizationId, person);
			const decided = decide(last);
			if (typeof decided === 'string') {
				return { outcome: decided, userId: person };
			}
			const { change, position } = decided;
			// The sync's rows of the user in the tenant are written in a strictly increasing `at` (never before the last
			// one, whatever the clock does), so "newest by time" is always "last written".
			const newest = await this.newestRow(tx, link.tenantId, person);
			const at = Math.max(this.now(), (newest?.at ?? 0) + 1);
			const seq = (newest?.seq ?? 0) + 1;
			const grant = await this.latestGrant(tx, link.tenantId, person);
			const other = grant ? await this.heldElsewhere(tx, link.tenantId, others, person, grant) : false;
			const step = await this.change(tx, change, everRole, link, person, position, last, grant, other);
			if (resync && unchangedFor(step, change, last, link)) {
				// Nothing changed and the memory already says so: a resync at every start adds no row.
				return { outcome: step.outcome, userId: person };
			}
			await this.audit.record(
				{
					at,
					action: MEMBERSHIP_AUDIT_ACTION,
					actorLabel: 'platform',
					tenantId: link.tenantId,
					organizationId: link.organizationId,
					details: {
						event_id: position.eventId,
						occurred_at: position.occurredAt,
						seq,
						link_id: link.linkId,
						op: change,
						role: everRole,
						user_id: person,
						result: step.outcome,
						from: auditable(step.from),
						to: auditable(step.to),
						held: step.held,
						restore: step.restore,
						grant: step.grant,
						voids: step.voids ?? null,
						...(resync ? { source: 'resync' } : {})
					}
				},
				tx
			);
			if (step.voids) {
				// The end of a grant is the tenant's, not the organization's: kept in a row of the tenant (no
				// organization), which deleting the organization (and its audit rows) does not remove.
				await this.audit.record(
					{
						at: at + 1,
						action: MEMBERSHIP_AUDIT_ACTION,
						actorLabel: 'platform',
						tenantId: link.tenantId,
						organizationId: null,
						details: {
							event_id: position.eventId,
							occurred_at: position.occurredAt,
							seq: seq + 1,
							user_id: person,
							result: step.outcome,
							held: false,
							voids: step.voids
						}
					},
					tx
				);
			}
			return { outcome: step.outcome, userId: person };
		});
	}

	/**
	 * The one Gauzy user of `tenantId` linked to the event's Ever ID, `person_unknown` when there is none (or two),
	 * `person_mismatch` when the event names another user.
	 */
	private async personOf(
		tx: EverConnectSql,
		tenantId: string,
		data: MembershipEventData
	): Promise<string | 'person_unknown' | 'person_mismatch'> {
		const q = (name: string) => tx.q(name);
		// Locked on Postgres and MySQL until this change commits (the Ever ID link rows; Postgres only those).
		const lock = tx.dialect === 'postgres' ? ' FOR UPDATE OF a' : tx.dialect === 'mysql' ? ' FOR UPDATE' : '';
		const { rows } = await tx.run(
			`SELECT a.${q('userId')} AS ${q('userId')}, a.${q('issuer')} AS ${q('issuer')}, a.${q('subject')} AS ${q('subject')} ` +
				`FROM ${q('zitadel_account')} a INNER JOIN ${q('user')} u ON u.${q('id')} = a.${q('userId')} ` +
				`WHERE a.${q('subject')} = ${tx.ph(1)} AND u.${q('tenantId')} = ${tx.ph(2)} ` +
				`AND a.${q('deletedAt')} IS NULL AND u.${q('deletedAt')} IS NULL${lock}`,
			[data.subject, tenantId]
		);
		const wanted = sameIssuer(data.issuer);
		const users = new Set(
			rows
				// A subject is case-sensitive: compared here exactly, whatever the database's collation matched.
				.filter((row) => String(row['subject'] ?? '') === data.subject)
				.filter((row) => sameIssuer(String(row['issuer'] ?? '')) === wanted)
				.map((row) => String(row['userId']))
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

	/** The sync's last-written row of the user in the tenant (any organization), with its `at`; `null`: none. */
	private async newestRow(
		tx: EverConnectSql,
		tenantId: string,
		userId: string
	): Promise<{ at: number; seq: number } | null> {
		const q = (name: string) => tx.q(name);
		const { rows } = await tx.run(
			`SELECT ${q('at')}, ${q('details')} FROM ${q('ever_connect_audit')} WHERE ${q('tenantId')} = ${tx.ph(1)} ` +
				`AND ${q('action')} = ${tx.ph(2)} AND ${q('details')} LIKE ${tx.ph(3)} ` +
				`ORDER BY ${q('at')} DESC, ${q('id')} DESC LIMIT 1`,
			[tenantId, MEMBERSHIP_AUDIT_ACTION, `%"user_id":${JSON.stringify(userId)}%`]
		);
		const state = rows[0] ? stateOf(rows[0], userId) : null;
		return rows[0] ? { at: num(rows[0]['at']) ?? 0, seq: state?.seq ?? 0 } : null;
	}

	/**
	 * The sync's current grant of `ADMIN` to the user in the tenant (any organization), or `null`. Every row that holds
	 * a grant names the latest one, so the last-written holding row names the candidate; it is current unless a row
	 * ended it (`voids` naming it, by id): the user was found no longer `ADMIN` while it was held (a role changed in
	 * Gauzy), or a newer grant replaced it. Those ends are also kept in rows of the tenant, which deleting an
	 * organization does not remove, and an end names one grant only, so it never hides a newer one.
	 */
	private async latestGrant(tx: EverConnectSql, tenantId: string, userId: string): Promise<Grant | null> {
		const q = (name: string) => tx.q(name);
		const user = `%"user_id":${JSON.stringify(userId)}%`;
		const { rows } = await tx.run(
			`SELECT ${q('details')} FROM ${q('ever_connect_audit')} WHERE ${q('tenantId')} = ${tx.ph(1)} ` +
				`AND ${q('action')} = ${tx.ph(2)} AND ${q('details')} LIKE ${tx.ph(3)} AND ${q('details')} LIKE ${tx.ph(4)} ` +
				`ORDER BY ${q('at')} DESC, ${q('id')} DESC LIMIT 1`,
			[tenantId, MEMBERSHIP_AUDIT_ACTION, user, '%"held":true%']
		);
		const state = rows[0] ? stateOf(rows[0], userId) : null;
		if (!state?.held || !state.grant) {
			return null;
		}
		const ended = await tx.run(
			`SELECT ${q('id')} FROM ${q('ever_connect_audit')} WHERE ${q('tenantId')} = ${tx.ph(1)} ` +
				`AND ${q('action')} = ${tx.ph(2)} AND ${q('details')} LIKE ${tx.ph(3)} AND ${q('details')} LIKE ${tx.ph(4)} LIMIT 1`,
			[tenantId, MEMBERSHIP_AUDIT_ACTION, user, `%"voids":${JSON.stringify(state.grant)}%`]
		);
		return ended.rows.length ? null : { grant: state.grant, restore: state.restore };
	}

	/**
	 * Whether another live link of the same tenant holds `grant`: its organization's own last change (read however
	 * long ago it was made) keeps the user `ADMIN` under that grant.
	 */
	private async heldElsewhere(
		tx: EverConnectSql,
		tenantId: string,
		others: ReadonlyArray<{ organizationId: string; linkId: string }>,
		userId: string,
		grant: Grant
	): Promise<boolean> {
		for (const other of others) {
			const state = await this.stateIn(tx, tenantId, other.organizationId, userId);
			// Recorded through that live link: a hold of an earlier link of the same organization (unlinked, then
			// linked again) is void, as unlinking voids it.
			if (state?.held && state.grant === grant.grant && state.linkId === other.linkId) {
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
		// The hold this organization has now: only one on the latest grant, recorded through this same link, counts.
		const holds = !!(last?.held && grant && last.grant === grant.grant && last.linkId === link.linkId);
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
				return { ...NO_HOLD, voids: grant?.grant ?? null, outcome: 'changed_here', ...same };
			}
			// A new grant: the earlier one (if any) ends here, for every organization that held it.
			return {
				outcome: 'role_granted',
				held: true,
				restore: account.roleId,
				grant: position.eventId,
				voids: grant?.grant ?? null,
				from: account.role,
				to: GAUZY_ADMIN
			};
		}
		// No role from Ever: take back an ADMIN the sync granted, and nothing else.
		if (!holds || !grant) {
			return { ...NO_HOLD, outcome: 'unchanged', ...same };
		}
		if (account.role !== GAUZY_ADMIN) {
			// The role was changed in Gauzy since the grant: left as it is, and this row voids the grant for every
			// organization that held it (see `latestGrant`), so none takes a later ADMIN given in Gauzy for its own.
			return { ...NO_HOLD, voids: grant.grant, outcome: 'changed_here', ...same };
		}
		if (other) {
			return { ...NO_HOLD, outcome: 'kept_for_other_link', ...same };
		}
		// The role the grant replaced; when it no longer exists, the tenant's least-privileged role (VIEWER, else
		// EMPLOYEE, else no role at all): the sync's ADMIN never stays with someone Ever no longer makes an
		// administrator.
		let restore = grant.restore;
		if (restore !== null && !account.roles.has(restore)) {
			restore = roleIdOf(account.roles, GAUZY_VIEWER) ?? roleIdOf(account.roles, GAUZY_EMPLOYEE);
		}
		if (!(await this.setRole(tx, account, restore))) {
			return { ...NO_HOLD, voids: grant.grant, outcome: 'changed_here', ...same };
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

	/**
	 * The user's memberships of the organization that are not deleted: whether one is usable (active and not archived,
	 * as Gauzy requires to switch into the organization), else one that is not.
	 */
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
		const active = rows.some((row) => isUsableRow(row));
		const inactive = rows.find((row) => !isUsableRow(row));
		return { active, inactiveId: inactive ? String(inactive['id']) : null };
	}

	/**
	 * Makes the user a member of the organization: a membership that is inactive or archived is made usable again
	 * (Ever says the person is a member), else one is added.
	 */
	private async join(tx: EverConnectSql, link: LinkRecord, userId: string, inactiveId: string | null): Promise<void> {
		if (
			inactiveId &&
			(await tx.update('user_organization', { isActive: true, isArchived: false }, { id: inactiveId })) > 0
		) {
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
	const linkId = details['link_id'];
	const seq = details['seq'];
	const voids = details['voids'];
	return {
		eventId: String(details['event_id']).toUpperCase(),
		occurredAt: typeof occurredAt === 'number' && Number.isFinite(occurredAt) ? occurredAt : null,
		op: typeof details['op'] === 'string' ? details['op'] : null,
		result: typeof details['result'] === 'string' ? details['result'] : null,
		held: details['held'] === true,
		restore: typeof restore === 'string' && restore ? restore : null,
		grant: typeof grant === 'string' && grant ? grant : null,
		linkId: typeof linkId === 'string' && linkId ? linkId : null,
		seq: typeof seq === 'number' && Number.isFinite(seq) ? seq : 0,
		voids: typeof voids === 'string' && voids ? voids : null
	};
}

/** The outcomes after which a `created` or `role_changed` leaves the user no member of the organization. */
const NOT_MADE_A_MEMBER = new Set(['not_a_member', 'account_missing', 'super_admin_kept']);

/**
 * Whether the sync keeps the user as a member of the organization: its last change for them (an event or a resync)
 * was `created` or `role_changed` and left them a member.
 */
function isKeptMember(last: Pick<SyncState, 'op' | 'result'> | null): boolean {
	return !!last && (last.op === 'created' || last.op === 'role_changed') && !NOT_MADE_A_MEMBER.has(last.result ?? '');
}

/** Outcomes that change neither the user nor their membership. */
const NO_CHANGE = new Set(['unchanged', 'super_admin_kept', 'account_missing', 'role_missing', 'kept_for_other_link']);

/**
 * Whether a resync's step changed nothing that the user's last row in the organization does not already say: no
 * change of role or membership, the same answer to "kept as a member", the same hold, through the same link.
 */
function unchangedFor(step: RoleStep, change: MembershipChange, last: SyncState | null, link: LinkRecord): boolean {
	if (step.outcome === 'not_a_member') {
		return true;
	}
	return (
		NO_CHANGE.has(step.outcome) &&
		!!last &&
		!step.voids &&
		isKeptMember(last) === isKeptMember({ op: change, result: step.outcome }) &&
		step.held === last.held &&
		step.grant === last.grant &&
		step.restore === last.restore &&
		(!step.held || last.linkId === link.linkId)
	);
}

/** A failure as the log says it: the status and code of Ever Platform's answer, else the error's name. */
function failureCode(error: unknown): string {
	if (error instanceof ProblemError) return `${error.status} ${error.code}`;
	return error instanceof Error ? error.name : 'error';
}

/** `code=count` pairs, by code. */
function summary(counts: ReadonlyMap<string, number>): string {
	if (counts.size === 0) return 'nothing applied';
	return [...counts.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([code, n]) => `${code}=${n}`)
		.join(' ');
}

/** The id of the tenant's role named `name`, or `null`. */
function roleIdOf(roles: Map<string, string>, name: string): string | null {
	for (const [id, roleName] of roles) {
		if (roleName === name) return id;
	}
	return null;
}

/** A `user_organization` row Gauzy lets the user switch into: active (`isActive` true, or not set) and not archived. */
function isUsableRow(row: Row): boolean {
	const active = row['isActive'];
	const archived = row['isArchived'];
	const isTrue = (value: unknown) => value === true || value === 1 || value === '1' || value === 't';
	return (active === null || active === undefined || isTrue(active)) && !isTrue(archived);
}

/** A role name as the audit takes it (ids, states and names only), else `null`. */
function auditable(name: string | null): string | null {
	return name !== null && name.length <= 128 && !/@|:\/\//.test(name) ? name : null;
}
