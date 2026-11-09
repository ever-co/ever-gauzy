import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Equal, In, LessThan } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RealtimeReplayWatermark, REALTIME_TENANT_WIDE_SCOPE } from './realtime.entities';

/** A position in catch-up order: the epoch ms of a row's `createdAt`, then its `eventId`. */
export interface IRealtimeReplayPosition {
	at: number;
	eventId: string;
}

/** Whether position `a` comes after position `b` in catch-up order (time, then event id). */
export function isLaterPosition(a: IRealtimeReplayPosition, b: IRealtimeReplayPosition | null): boolean {
	if (!b) return true;
	return a.at > b.at || (a.at === b.at && a.eventId.localeCompare(b.eventId) > 0);
}

/** The latest of some positions, or null when there is none. */
export function latestPosition(positions: readonly IRealtimeReplayPosition[]): IRealtimeReplayPosition | null {
	let latest: IRealtimeReplayPosition | null = null;
	for (const position of positions) {
		if (isLaterPosition(position, latest)) latest = position;
	}
	return latest;
}

/** The scope key of a watermark row: the organization, or the tenant-wide rows. */
export function scopeKeyOf(organizationId: ID | null | undefined): string {
	return organizationId ? String(organizationId) : REALTIME_TENANT_WIDE_SCOPE;
}

/** A watermark row as a position. */
function positionOf(row: Pick<RealtimeReplayWatermark, 'prunedAt' | 'prunedEventId'>): IRealtimeReplayPosition | null {
	const at = new Date(row.prunedAt as unknown as string).getTime();
	return Number.isFinite(at) && row.prunedEventId ? { at, eventId: String(row.prunedEventId) } : null;
}

/**
 * The replay watermark: how far a retention removed the outbox rows of a scope (spec FR-3).
 *
 * The catch-up is a replay of the outbox, so it can only promise every event after a cursor while no row after that
 * cursor was removed. A retention that removes rows of a scope records here, **in the transaction that removes them**
 * ({@link advance}), the position of the newest one it removed; a catch-up answers `resync` exactly when its cursor
 * precedes the watermark of what the caller reads — the organization's rows and the tenant-wide ones.
 *
 * Nothing removes outbox rows today, so no watermark exists and no catch-up answers `resync`: the window is everything
 * retained. This replaces the earlier guess from the oldest retained row, which told a client whose cursor predated
 * its organization's first event (or an organization with no event yet) to refetch although nothing was lost.
 */
@Injectable()
export class RealtimeReplayWatermarkService {
	constructor(private readonly dataSource: DataSource) {}

	/**
	 * The watermark of what a caller of the scope reads, or null when nothing of it was removed.
	 *
	 * @param tenantId The caller's tenant.
	 * @param organizationId The caller's organization; without one, the caller reads the tenant-wide rows only.
	 */
	async forScope(tenantId: ID, organizationId: ID | null): Promise<IRealtimeReplayPosition | null> {
		const keys = organizationId ? [scopeKeyOf(organizationId), REALTIME_TENANT_WIDE_SCOPE] : [REALTIME_TENANT_WIDE_SCOPE];
		const rows = await this.dataSource.getRepository(RealtimeReplayWatermark).find({
			select: { id: true, prunedAt: true, prunedEventId: true },
			where: { tenantId, scopeKey: In(keys) }
		});
		return latestPosition(rows.map(positionOf).filter((position): position is IRealtimeReplayPosition => !!position));
	}

	/**
	 * Records that a retention removed a scope's rows up to a position. For the retention itself: called with the
	 * manager of the transaction that removes the rows, so the watermark and the removal commit together. A watermark
	 * only moves forward, and atomically: the scope's row is created when missing (an insert ignored when another
	 * transaction created it first), then moved by conditional updates that each compare and write under the row's lock
	 * — so two retentions of one scope, in whatever order they commit, leave the later position.
	 *
	 * @param manager The retention's transaction manager.
	 * @param scope The tenant and the organization (null for the tenant-wide rows) the removed rows belong to.
	 * @param position The newest removed row's position.
	 */
	async advance(manager: EntityManager, scope: { tenantId: ID; organizationId: ID | null }, position: IRealtimeReplayPosition): Promise<void> {
		const repository = manager.getRepository(RealtimeReplayWatermark);
		const key = { tenantId: scope.tenantId, scopeKey: scopeKeyOf(scope.organizationId) };
		const prunedAt = new Date(position.at);
		const prunedEventId = position.eventId as ID;
		await repository
			.createQueryBuilder()
			.insert()
			.into(RealtimeReplayWatermark)
			.values({ ...key, organizationId: scope.organizationId ?? undefined, prunedAt, prunedEventId })
			.orIgnore()
			// Nothing is read back: an ignored insert returns no row on Postgres.
			.updateEntity(false)
			.execute();
		// A later time; or the same time and a later event id. A position at or before the recorded one matches neither.
		await repository.update({ ...key, prunedAt: LessThan(prunedAt) }, { prunedAt, prunedEventId });
		await repository.update({ ...key, prunedAt: Equal(prunedAt), prunedEventId: LessThan(prunedEventId) }, { prunedEventId });
	}
}
