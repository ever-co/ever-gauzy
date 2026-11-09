import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In, LessThanOrEqual, Not } from 'typeorm';
import { ID, RealtimePresenceStatus } from '@gauzy/contracts';
import { Employee } from '@gauzy/core';
import { REALTIME_PRESENCE_TTL_MS } from './realtime.constants';
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
	 * process runs it; the lock of {@link report} makes a second process find nothing left to settle.
	 *
	 * @param now The moment to judge expiry at.
	 * @param limit The most employees settled in one pass.
	 * @returns The outcome of each employee settled.
	 */
	async sweep(now: Date, limit = 100): Promise<IPresenceOutcome[]> {
		const lapsed = await this.dataSource.getRepository(RealtimePresence).find({
			select: { tenantId: true, employeeId: true, userId: true, organizationId: true },
			where: { expiresAt: LessThanOrEqual(now), connectionId: Not(In([REALTIME_PUBLISHED_PRESENCE_KEY, REALTIME_SHARED_CONNECTION_KEY])) },
			order: { expiresAt: 'ASC' },
			take: limit
		});
		const employees = new Map<string, RealtimePresence>();
		for (const row of lapsed) employees.set(`${row.tenantId}|${row.employeeId}`, row);
		const outcomes: IPresenceOutcome[] = [];
		for (const row of employees.values()) {
			const scope = { tenantId: row.tenantId as ID, organizationId: (row.organizationId as ID) ?? null, employeeId: row.employeeId, userId: row.userId };
			outcomes.push(
				await this.dataSource.transaction(async (manager) => {
					const published = await this.lockPublished(manager, scope);
					const outcome = await this.merge(manager, scope, published, now);
					await manager.getRepository(Employee).update(
						{ id: scope.employeeId, tenantId: scope.tenantId },
						{ isIdle: outcome.status !== RealtimePresenceStatus.ACTIVE }
					);
					return outcome;
				})
			);
		}
		return outcomes;
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
		if (changed) await repository.update({ id: published.id }, { status });
		return {
			tenantId: scope.tenantId,
			organizationId: (published.organizationId as ID) ?? scope.organizationId ?? null,
			employeeId: scope.employeeId,
			userId: (published.userId as ID) ?? scope.userId,
			status,
			changed
		};
	}
}

