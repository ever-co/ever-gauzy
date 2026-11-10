import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, Equal, In, IsNull, LessThan, LessThanOrEqual, Not } from 'typeorm';
import { ID, RealtimePresenceStatus } from '@gauzy/contracts';
import { Employee } from '@gauzy/core';
import { REALTIME_PRESENCE_COALESCE_MS, REALTIME_PRESENCE_TTL_MS } from './realtime.constants';
import { RealtimePresence, REALTIME_PUBLISHED_PRESENCE_KEY, REALTIME_SHARED_CONNECTION_KEY } from './realtime.entities';

/** How present each status is: the merged presence of an employee is the most present of their connections. */
const PRESENCE_RANK: Readonly<Record<string, number>> = {
	[RealtimePresenceStatus.ACTIVE]: 3,
	[RealtimePresenceStatus.IDLE]: 2,
	[RealtimePresenceStatus.AWAY]: 1
};

/**
 * One presence for an employee from what each of their connections reports: `active` if any connection is active,
 * else `idle` if any is idle, else `away` if any is away, else `offline` (no connection left).
 */
export function mergePresence(statuses: readonly string[]): RealtimePresenceStatus {
	let merged: RealtimePresenceStatus = RealtimePresenceStatus.OFFLINE;
	let rank = 0;
	for (const status of statuses) {
		const candidate = PRESENCE_RANK[status] ?? 0;
		if (candidate > rank) {
			rank = candidate;
			merged = status as RealtimePresenceStatus;
		}
	}
	return merged;
}

/** Whether a connection row still counts at a moment: a row without an expiry never lapses. */
export function isLive(row: Pick<RealtimePresence, 'expiresAt'>, now: Date): boolean {
	if (!row.expiresAt) return true;
	return new Date(row.expiresAt as unknown as string).getTime() > now.getTime();
}

/** One report of one connection. */
export interface IPresenceReport {
	tenantId: ID;
	organizationId: ID | null;
	employeeId: ID;
	userId: ID;
	/** The client's connection id, or {@link REALTIME_SHARED_CONNECTION_KEY} for a client that names none. */
	connectionId: string;
	status: RealtimePresenceStatus;
	now: Date;
}

/** An employee's merged presence after a report or a sweep, and whether it differs from the one last published. */
export interface IPresenceOutcome {
	tenantId: ID;
	organizationId: ID | null;
	employeeId: ID;
	userId: ID;
	status: RealtimePresenceStatus;
	changed: boolean;
	/** The published row's revision after this report or sweep: higher for every change of this employee. */
	revision: number;
}

/**
 * What an attempt to tell the organization of an employee's presence may do now ({@link
 * RealtimePresenceStore.claimPublication}): publish this outcome (this process claimed the window), try again at a
 * moment (the window is still open, or another process claimed it meanwhile), or nothing (no revision is left untold).
 */
export type PresencePublication =
	| { kind: 'publish'; outcome: IPresenceOutcome; claim: IPresenceClaim }
	| { kind: 'later'; at: number }
	| { kind: 'none' };

/** A won claim: what it wrote on the published row, and what was there before (to give it back, see `release`). */
export interface IPresenceClaim {
	id: ID;
	at: Date;
	revision: number;
	previousAt: Date | null;
	previousRevision: number;
}

/** An employee whose published row holds a revision the organization was not told yet. */
export interface IPresenceScope {
	tenantId: ID;
	employeeId: ID;
}

/**
 * Presence per connection (spec FR-7), shared by every API process through the plugin's `realtime_presence` table.
 *
 * Each connection of an employee (a tab, a device) reports its own status under its own id; the employee's presence is
 * the merge of the connections that still count ({@link mergePresence}). A connection counts until it reports
 * `offline` (a closing tab) or until {@link REALTIME_PRESENCE_TTL_MS} passes without a report from it (a tab that
 * crashed, a device that lost its network), so closing one of two tabs leaves the employee as present as the other
 * tab says. A client that names no connection reports under one connection its tabs share, which never lapses: the
 * last report of any of them wins, as before connections were told apart.
 *
 * Every change of an employee's presence runs in one transaction that first locks the employee's published row (the
 * presence last told to the organization), so two reports of one employee — two tabs, two API processes — are applied
 * one after the other, and the merge, the published row and `Employee.isIdle` always agree. The outcome says whether
 * the merged presence differs from the published one: only then is the organization told.
 */
@Injectable()
export class RealtimePresenceStore {
	private readonly logger = new Logger('RealtimePresenceStore');

	constructor(private readonly dataSource: DataSource) {}

	/**
	 * Applies one connection's report: records it (or forgets the connection when it reports `offline`), merges the
	 * employee's live connections, and persists the merge (`Employee.lastSeenAt`, `Employee.isIdle`).
	 */
	async report(report: IPresenceReport): Promise<IPresenceOutcome> {
		return this.dataSource.transaction(async (manager) => {
			const published = await this.lockPublished(manager, report);
			const connections = manager.getRepository(RealtimePresence);
			const own = { tenantId: report.tenantId, employeeId: report.employeeId, connectionId: report.connectionId };
			if (report.status === RealtimePresenceStatus.OFFLINE) {
				await connections.delete(own);
			} else {
				const expiresAt = report.connectionId === REALTIME_SHARED_CONNECTION_KEY ? null : new Date(report.now.getTime() + REALTIME_PRESENCE_TTL_MS);
				const existing = await connections.findOne({ select: { id: true }, where: own });
				if (existing) {
					await connections.update({ id: existing.id }, { status: report.status, expiresAt: expiresAt as never, userId: report.userId });
				} else {
					await connections.save(
						connections.create({
							...own,
							userId: report.userId,
							organizationId: report.organizationId ?? undefined,
							status: report.status,
							expiresAt: expiresAt ?? undefined
						})
					);
				}
			}
			const outcome = await this.merge(manager, report, published, report.now);
			await manager.getRepository(Employee).update(
				{ id: report.employeeId, tenantId: report.tenantId },
				{ lastSeenAt: report.now, isIdle: outcome.status !== RealtimePresenceStatus.ACTIVE }
			);
			return outcome;
		});
	}

	/**
	 * Settles the employees with a connection that lapsed by `now`: forgets those connections and merges again. Every
	 * process runs it; the lock of {@link report} makes a second process find nothing left to settle. Each employee is
	 * settled in a transaction of its own and handed to `settled` once it committed, so an employee whose transaction
	 * fails (logged, settled by a later pass) never holds back the others' notices.
	 *
	 * @param now The moment to judge expiry at.
	 * @param settled Called with each employee's outcome as soon as it committed.
	 * @param limit The most lapsed connections read in one pass.
	 * @returns How many employees were settled, and how many failed.
	 */
	async sweep(now: Date, settled: (outcome: IPresenceOutcome) => Promise<void>, limit = 100): Promise<{ settled: number; failed: number }> {
		const lapsed = await this.dataSource.getRepository(RealtimePresence).find({
			select: { tenantId: true, employeeId: true, userId: true, organizationId: true },
			where: { expiresAt: LessThanOrEqual(now), connectionId: Not(In([REALTIME_PUBLISHED_PRESENCE_KEY, REALTIME_SHARED_CONNECTION_KEY])) },
			order: { expiresAt: 'ASC' },
			take: limit
		});
		const employees = new Map<string, RealtimePresence>();
		for (const row of lapsed) employees.set(`${row.tenantId}|${row.employeeId}`, row);
		const counts = { settled: 0, failed: 0 };
		for (const row of employees.values()) {
			const scope = { tenantId: row.tenantId as ID, organizationId: (row.organizationId as ID) ?? null, employeeId: row.employeeId, userId: row.userId };
			let outcome: IPresenceOutcome;
			try {
				outcome = await this.dataSource.transaction(async (manager) => {
					const published = await this.lockPublished(manager, scope);
					const merged = await this.merge(manager, scope, published, now);
					await manager.getRepository(Employee).update(
						{ id: scope.employeeId, tenantId: scope.tenantId },
						{ isIdle: merged.status !== RealtimePresenceStatus.ACTIVE }
					);
					return merged;
				});
			} catch (error) {
				counts.failed += 1;
				this.logger.warn(`The lapsed presence of employee ${scope.employeeId} was not settled: ${(error as Error)?.message}`);
				continue;
			}
			counts.settled += 1;
			await settled(outcome);
		}
		return counts;
	}

	/**
	 * Claims the right to tell the organization of the employee's presence now, at most once per
	 * {@link REALTIME_PRESENCE_COALESCE_MS} whichever process asks (spec §4: one message per employee per 5 s).
	 *
	 * The published row says which revision was last told and when. A conditional update moves both, and only when the
	 * window since the last publication closed and the revision is newer: two processes asking at once cannot both
	 * win, and an older revision is never told after a newer one. The winner publishes the row's current state — the
	 * latest change of the window, not necessarily the one that asked. A loser (or an asker inside the window) is told
	 * when to try again, so the window's last change is told when it closes.
	 *
	 * @param scope The employee.
	 * @param now The moment of the claim — taken when claiming, never the start of the report or sweep that asks (they
	 * may have waited on the database since), so the window recorded is the one the publication really opens.
	 */
	async claimPublication(scope: IPresenceScope, now: Date = new Date()): Promise<PresencePublication> {
		const repository = this.dataSource.getRepository(RealtimePresence);
		const row = await repository.findOne({
			where: { tenantId: scope.tenantId, employeeId: scope.employeeId, connectionId: REALTIME_PUBLISHED_PRESENCE_KEY }
		});
		if (!row) return { kind: 'none' };
		const revision = Number(row.revision) || 0;
		const previousRevision = Number(row.publishedRevision) || 0;
		if (revision <= previousRevision) return { kind: 'none' };
		const last = row.publishedAt ? new Date(row.publishedAt as unknown as string).getTime() : null;
		if (last !== null && Number.isFinite(last) && now.getTime() - last < REALTIME_PRESENCE_COALESCE_MS) {
			return { kind: 'later', at: last + REALTIME_PRESENCE_COALESCE_MS };
		}
		const claim = { publishedAt: now, publishedRevision: revision };
		const newer = { id: row.id, publishedRevision: LessThan(revision) };
		const claimed =
			((await repository.update({ ...newer, publishedAt: IsNull() }, claim)).affected ?? 0) > 0 ||
			((await repository.update({ ...newer, publishedAt: LessThanOrEqual(new Date(now.getTime() - REALTIME_PRESENCE_COALESCE_MS)) }, claim)).affected ?? 0) > 0;
		if (!claimed) {
			// Another process claimed the window in between: what it may have left untold is tried once the window closes.
			return { kind: 'later', at: now.getTime() + REALTIME_PRESENCE_COALESCE_MS };
		}
		return {
			kind: 'publish',
			claim: { id: row.id as ID, at: now, revision, previousAt: last !== null && Number.isFinite(last) ? new Date(last) : null, previousRevision },
			outcome: {
				tenantId: row.tenantId as ID,
				organizationId: (row.organizationId as ID) ?? null,
				employeeId: row.employeeId,
				userId: row.userId,
				status: row.status as RealtimePresenceStatus,
				changed: true,
				revision
			}
		};
	}

	/**
	 * Gives a won claim back, when its publication will not happen (the process stops): the published row returns to
	 * what it said before the claim, so the revision is untold again and the next sweep of any process tells it. A
	 * compare-and-set on what the claim wrote: a later claim is never undone.
	 */
	async release(claim: IPresenceClaim): Promise<boolean> {
		const result = await this.dataSource
			.getRepository(RealtimePresence)
			.update(
				{ id: claim.id, publishedRevision: claim.revision, publishedAt: Equal(claim.at) },
				{ publishedRevision: claim.previousRevision, publishedAt: claim.previousAt as never }
			);
		return (result.affected ?? 0) > 0;
	}

	/**
	 * The employees whose published row holds a revision not told yet and whose window closed — a change whose process
	 * stopped before telling it. The sweep tells them ({@link claimPublication} decides who).
	 */
	async untold(now: Date, limit = 100): Promise<IPresenceScope[]> {
		const rows = await this.dataSource
			.getRepository(RealtimePresence)
			.createQueryBuilder('presence')
			.select(['presence.id', 'presence.tenantId', 'presence.employeeId'])
			.where('presence.connectionId = :key', { key: REALTIME_PUBLISHED_PRESENCE_KEY })
			.andWhere('presence.revision > presence.publishedRevision')
			.andWhere('(presence.publishedAt IS NULL OR presence.publishedAt <= :cutoff)', { cutoff: new Date(now.getTime() - REALTIME_PRESENCE_COALESCE_MS) })
			.take(limit)
			.getMany();
		return rows.map((row) => ({ tenantId: row.tenantId as ID, employeeId: row.employeeId }));
	}

	/**
	 * The employee's published row, created (as `offline`: nothing told yet) when missing, and locked for the rest of
	 * the transaction by an update — the statement every dialect locks a row with (SQLite has one writer at a time).
	 */
	private async lockPublished(
		manager: EntityManager,
		scope: { tenantId: ID; organizationId: ID | null; employeeId: ID; userId: ID }
	): Promise<RealtimePresence> {
		const repository = manager.getRepository(RealtimePresence);
		const key = { tenantId: scope.tenantId, employeeId: scope.employeeId, connectionId: REALTIME_PUBLISHED_PRESENCE_KEY };
		await repository
			.createQueryBuilder()
			.insert()
			.into(RealtimePresence)
			.values({
				...key,
				userId: scope.userId,
				organizationId: scope.organizationId ?? undefined,
				status: RealtimePresenceStatus.OFFLINE
			})
			// A concurrent first report of the same employee inserted it: that row is the one locked below.
			.orIgnore()
			// Nothing is read back: an ignored insert returns no row on Postgres (`ON CONFLICT DO NOTHING ... RETURNING`).
			.updateEntity(false)
			.execute();
		await repository.update(key, { updatedAt: new Date() });
		return (await repository.findOne({ where: key })) as RealtimePresence;
	}

	/** Forgets the lapsed connections, merges the live ones and records the merge on the published row when it changed. */
	private async merge(
		manager: EntityManager,
		scope: { tenantId: ID; organizationId: ID | null; employeeId: ID; userId: ID },
		published: RealtimePresence,
		now: Date
	): Promise<IPresenceOutcome> {
		const repository = manager.getRepository(RealtimePresence);
		const rows = await repository.find({
			select: { id: true, status: true, expiresAt: true },
			where: { tenantId: scope.tenantId, employeeId: scope.employeeId, connectionId: Not(REALTIME_PUBLISHED_PRESENCE_KEY) }
		});
		const lapsed = rows.filter((row) => !isLive(row, now)).map((row) => row.id as ID);
		if (lapsed.length) await repository.delete({ id: In(lapsed) });
		const status = mergePresence(rows.filter((row) => isLive(row, now)).map((row) => row.status));
		const changed = published.status !== status;
		const revision = (Number(published.revision) || 0) + (changed ? 1 : 0);
		if (changed) await repository.update({ id: published.id }, { status, revision });
		return {
			tenantId: scope.tenantId,
			organizationId: (published.organizationId as ID) ?? scope.organizationId ?? null,
			employeeId: scope.employeeId,
			userId: (published.userId as ID) ?? scope.userId,
			status,
			changed,
			revision
		};
	}
}

