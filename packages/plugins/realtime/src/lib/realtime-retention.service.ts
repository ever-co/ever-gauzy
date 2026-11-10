import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DataSource, Equal, FindOptionsWhere, In, IsNull, LessThan } from 'typeorm';
import { EventOutboxStatus, ID } from '@gauzy/contracts';
import { EventOutbox, SubscriptionCatalogue } from '@gauzy/core';
import { collaborationReplayNames } from './graphql/realtime-envelope';
import {
	REALTIME_RETENTION_BATCH,
	REALTIME_RETENTION_INTERVAL_MS,
	REALTIME_RETENTION_MIN_AGE_MS,
	REALTIME_RETENTION_MIN_EVENTS,
	REALTIME_RETENTION_SCOPES_PER_PASS
} from './realtime.constants';
import { isRealtimeRetentionEnabled } from './realtime-enabled';
import { RealtimeReplayWatermarkService } from './realtime-replay-watermark.service';

/** The bounds of one pass (the constants, unless a caller states others). */
export interface IRetentionBounds {
	/** Rows younger than this are kept, however many a scope holds. */
	minAgeMs: number;
	/** The newest this many rows of each scope are kept, however old. */
	minEvents: number;
	/** The most rows one scope loses in one pass. */
	batch: number;
	/** The most scopes one pass looks at. */
	scopes: number;
}

/** What one pass removed, per scope. */
export interface IRetentionPass {
	removed: number;
	scopes: Array<{ tenantId: ID; organizationId: ID | null; removed: number }>;
}

const DEFAULT_BOUNDS: IRetentionBounds = {
	minAgeMs: REALTIME_RETENTION_MIN_AGE_MS,
	minEvents: REALTIME_RETENTION_MIN_EVENTS,
	batch: REALTIME_RETENTION_BATCH,
	scopes: REALTIME_RETENTION_SCOPES_PER_PASS
};

/**
 * Outbox retention for the collaboration events (spec FR-3, task T23).
 *
 * The catch-up replays the outbox, which nothing pruned: it grew with every hint. This removes the collaboration rows
 * the replay window no longer needs, and records each removal as the scope's replay watermark, so a client whose
 * cursor falls behind it is told to resynchronise instead of replaying a stream with a hole.
 *
 * **Conservative by construction.** A row is removed only when all of these hold:
 * - its name is one of the collaboration replay names this process declares (task, comment, mention, notification
 *   and document hints, and the chat and inbox families when those plugins load) — never another domain's event;
 * - it was dispatched (`PUBLISHED`): pending, failed and dead rows stay for the dispatcher and the operators;
 * - it is older than 24 hours, and it is not among the newest 1,000 collaboration rows of its scope (an organization,
 *   or the tenant-wide rows) — the replay window FR-3 promises is whichever of the two is larger;
 * - it carries a tenant (a row written outside a request belongs to nobody's catch-up).
 *
 * Each scope loses at most a batch of its oldest rows per pass, in one transaction that also advances the scope's
 * watermark to the newest row it removed ({@link RealtimeReplayWatermarkService.advance}); a failure removes nothing
 * and is retried by the next pass. Several processes may run it: a removal is by id (idempotent) and the watermark
 * only moves forward.
 *
 * **Off unless `GAUZY_REALTIME_RETENTION_ENABLED=true`**, separately from the plugin itself: it deletes rows, so an
 * installation turns it on deliberately — on production only after the backups-first check of its database.
 */
@Injectable()
export class RealtimeRetentionService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('RealtimeRetentionService');
	private timer: NodeJS.Timeout | null = null;
	private running = false;

	constructor(
		private readonly dataSource: DataSource,
		private readonly watermarks: RealtimeReplayWatermarkService,
		@Optional() private readonly moduleRef?: ModuleRef
	) {}

	onModuleInit(): void {
		if (!isRealtimeRetentionEnabled(process.env, (message) => this.logger.warn(message))) return;
		this.timer = setInterval(() => void this.run(), REALTIME_RETENTION_INTERVAL_MS);
		this.timer.unref?.();
	}

	onModuleDestroy(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}

	/** One pass, at most one at a time per process; a failure is logged and the next pass tries again. */
	async run(now: Date = new Date()): Promise<IRetentionPass | null> {
		if (this.running) return null;
		this.running = true;
		try {
			const pass = await this.prune(now);
			if (pass.removed) {
				this.logger.log(`Removed ${pass.removed} replayed collaboration event(s) from ${pass.scopes.length} scope(s).`);
			}
			return pass;
		} catch (error) {
			this.logger.warn(`The collaboration events were not pruned: ${(error as Error)?.message}`);
			return null;
		} finally {
			this.running = false;
		}
	}

	/**
	 * Removes, per scope, the collaboration rows past both bounds of the replay window, oldest first, and advances the
	 * scope's watermark in the same transaction.
	 *
	 * @param now The moment the age bound is measured from.
	 * @param bounds The bounds (the plugin's constants by default).
	 * @returns What was removed.
	 */
	async prune(now: Date, bounds: IRetentionBounds = DEFAULT_BOUNDS): Promise<IRetentionPass> {
		const names = collaborationReplayNames(this.find(SubscriptionCatalogue)?.names() ?? []);
		const cutoff = new Date(now.getTime() - bounds.minAgeMs);
		const repository = this.dataSource.getRepository(EventOutbox);

		// The scopes holding a row old enough to go.
		const scopes: Array<{ tenantId: ID; organizationId: ID | null }> = await repository
			.createQueryBuilder('outbox')
			.select('outbox.tenantId', 'tenantId')
			.addSelect('outbox.organizationId', 'organizationId')
			.where('outbox.eventName IN (:...names)', { names })
			.andWhere('outbox.status = :status', { status: EventOutboxStatus.PUBLISHED })
			.andWhere('outbox.createdAt < :cutoff', { cutoff })
			.andWhere('outbox.tenantId IS NOT NULL')
			.groupBy('outbox.tenantId')
			.addGroupBy('outbox.organizationId')
			.limit(bounds.scopes)
			.getRawMany();

		const pass: IRetentionPass = { removed: 0, scopes: [] };
		for (const raw of scopes) {
			const scope = { tenantId: raw.tenantId as ID, organizationId: (raw.organizationId as ID) ?? null };
			const removed = await this.pruneScope(scope, names, cutoff, bounds);
			if (removed) {
				pass.removed += removed;
				pass.scopes.push({ ...scope, removed });
			}
		}
		return pass;
	}

	/** One scope's batch: the rows past both bounds, removed with the watermark advanced, in one transaction. */
	private async pruneScope(
		scope: { tenantId: ID; organizationId: ID | null },
		names: readonly string[],
		cutoff: Date,
		bounds: IRetentionBounds
	): Promise<number> {
		return this.dataSource.transaction(async (manager) => {
			const repository = manager.getRepository(EventOutbox);
			const ofScope = {
				tenantId: scope.tenantId,
				organizationId: scope.organizationId ?? IsNull(),
				eventName: In([...names])
			} as FindOptionsWhere<EventOutbox>;

			// The count bound: the oldest of the newest `minEvents` rows of the scope, whatever their status. None: the
			// scope holds no more than that, and keeps everything.
			const [floor] = await repository.find({
				select: { id: true, createdAt: true, eventId: true },
				where: ofScope,
				order: { createdAt: 'DESC', eventId: 'DESC' },
				skip: bounds.minEvents - 1,
				take: 1
			});
			if (!floor?.createdAt) return 0;
			const floorAt = new Date(floor.createdAt as unknown as string);

			// Strictly before the floor in (createdAt, eventId) order, and older than the age bound; dispatched only.
			const dispatched = { ...ofScope, status: EventOutboxStatus.PUBLISHED } as FindOptionsWhere<EventOutbox>;
			const where: FindOptionsWhere<EventOutbox>[] =
				floorAt.getTime() < cutoff.getTime()
					? [
							{ ...dispatched, createdAt: LessThan(floorAt) },
							{ ...dispatched, createdAt: Equal(floorAt), eventId: LessThan(floor.eventId) }
						]
					: [{ ...dispatched, createdAt: LessThan(cutoff) }];
			const rows = await repository.find({
				select: { id: true, createdAt: true, eventId: true },
				where,
				order: { createdAt: 'ASC', eventId: 'ASC' },
				take: bounds.batch
			});
			if (!rows.length) return 0;

			await repository.delete({ id: In(rows.map((row) => row.id as ID)) });
			const newest = rows[rows.length - 1];
			await this.watermarks.advance(manager, scope, {
				at: new Date(newest.createdAt as unknown as string).getTime(),
				eventId: String(newest.eventId)
			});
			return rows.length;
		});
	}

	private find<T>(token: Type<T>): T | undefined {
		try {
			return this.moduleRef?.get(token, { strict: false }) ?? undefined;
		} catch {
			return undefined;
		}
	}
}
