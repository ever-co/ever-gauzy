import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In, LessThanOrEqual, MoreThan } from 'typeorm';
import { ID } from '@gauzy/contracts';
import type { EverWorksEventEnvelope } from '../../client/ever-works-client.types';
import { EverWorksConnection } from '../../connection/ever-works-connection.entity';
import { EverWorksSyncContext } from '../ever-works-sync.context';
import { EverWorksInboundEvent, EverWorksInboundStatus } from '../entities/ever-works-sync.entities';
import { EverWorksSyncLogService } from '../ever-works-sync-log.service';
import { compareSeq } from './ever-works-envelope';

/** What a handler decided for one event. */
export type EverWorksApplyOutcome =
	| { status: 'applied'; message?: string }
	| { status: 'skipped'; message: string }
	| { status: 'deferred'; message: string; retryInMs?: number };

/** The context a handler gets: the connection, the event row, and the mapped Gauzy organization. */
export interface EverWorksApplyContext {
	connection: EverWorksConnection;
	event: EverWorksInboundEvent;
	organizationId: ID | null;
}

/**
 * Applies one kind of Ever Works aggregate in Gauzy (tasks, teams, agents, …; plan items G-P1-6 to G-P1-9
 * register theirs). A handler resolves its dependencies, maps the DTO, runs the 3-way merge, writes
 * through Gauzy's services and updates its link — skipping events at or below the link's version.
 */
export interface EverWorksInboundHandler {
	readonly aggregateTypes: ReadonlyArray<string>;
	apply(envelope: EverWorksEventEnvelope, context: EverWorksApplyContext): Promise<EverWorksApplyOutcome>;
}

/** Attempts before an event is dead (plan 03 §C.3 uses 8 for pushes; inbound gets 10). */
export const INBOUND_MAX_ATTEMPTS = 10;
/** A deferred event is retried hourly (plan 03 §C.4). */
export const INBOUND_DEFER_MS = 60 * 60_000;
/** Pages of due events one drain reads at most (each `limit` long). */
export const INBOUND_MAX_PAGES = 10;

const UNFINISHED = [EverWorksInboundStatus.PENDING, EverWorksInboundStatus.DEFERRED, EverWorksInboundStatus.FAILED];

/** The process no longer holds the connection's lease: nothing more is written for it. */
export class EverWorksLeaseLostError extends Error {
	constructor() {
		super('The sync lease on this connection moved to another process.');
		this.name = 'EverWorksLeaseLostError';
	}
}

/**
 * The inbound applier (plan 03 §C.4): processes a connection's pending events grouped by aggregate, in
 * `seq` order within each aggregate, one aggregate at a time.
 *
 * - **Loop guard level 3:** an event whose origin is this connection is skipped.
 * - Every handler runs inside {@link EverWorksSyncContext} (loop guard level 1), so nothing it writes
 *   is captured as an outbound change.
 * - An event of a kind no handler covers yet is `deferred` (retried hourly), not lost: shipping the
 *   handler later applies it. An event without a mapped organization is `skipped`.
 * - A failure is retried with back-off and is `dead` after {@link INBOUND_MAX_ATTEMPTS}; the rest of
 *   that aggregate waits, so a later event never overtakes an earlier one.
 */
@Injectable()
export class EverWorksInboundApplier {
	private readonly logger = new Logger('EverWorksInbound');
	private readonly handlers = new Map<string, EverWorksInboundHandler>();

	constructor(
		private readonly dataSource: DataSource,
		private readonly log: EverWorksSyncLogService
	) {}

	/** Registers a handler for its aggregate types (the later registration wins). */
	register(handler: EverWorksInboundHandler): void {
		for (const type of handler.aggregateTypes) this.handlers.set(type, handler);
	}

	hasHandler(aggregateType: string): boolean {
		return this.handlers.has(aggregateType);
	}

	/**
	 * Processes up to `limit` due events of one connection; returns how many were settled. With `owner`
	 * (the sync loop's lease holder) every outcome is written only while that process still holds the
	 * connection's lease; once it does not, the drain stops (the next owner applies the event again, and
	 * handlers skip what their link's version already covers).
	 */
	async drain(
		connection: EverWorksConnection,
		limit = 200,
		now: Date = new Date(),
		stillOwner?: () => Promise<boolean>,
		owner?: string
	): Promise<number> {
		let settled = 0;
		let after: string | null = null;
		try {
			// Pages through the due events in `seq` order: an aggregate that must wait (an earlier event of
			// it is not due yet) never fills the batch and starves the others.
			for (let page = 0; page < INBOUND_MAX_PAGES && settled < limit; page++) {
				const due = await this.duePage(connection, now, after, limit);
				if (!due.length) break;
				after = String(due[due.length - 1].seq);
				const result = await this.drainPage(connection, due, now, limit - settled, stillOwner, owner);
				settled += result.settled;
				if (result.stopped || due.length < limit) break;
			}
		} catch (error) {
			if (!(error instanceof EverWorksLeaseLostError)) throw error;
			this.logger.warn(`Connection ${connection.id}: the lease moved to another process; the inbound drain stopped.`);
		}
		return settled;
	}

	/** One page of due events after `after` (by `seq`), oldest first. */
	private duePage(connection: EverWorksConnection, now: Date, after: string | null, take: number): Promise<EverWorksInboundEvent[]> {
		return this.dataSource.getRepository(EverWorksInboundEvent).find({
			where: {
				connectionId: connection.id as ID,
				status: In(UNFINISHED),
				availableAt: LessThanOrEqual(now),
				...(after !== null ? { seq: MoreThan(after) } : {})
			},
			order: { seq: 'ASC' },
			take
		});
	}

	/** Applies one page, aggregate by aggregate; `stopped` when the lease check said to stop. */
	private async drainPage(
		connection: EverWorksConnection,
		due: EverWorksInboundEvent[],
		now: Date,
		budget: number,
		stillOwner: (() => Promise<boolean>) | undefined,
		owner: string | undefined
	): Promise<{ settled: number; stopped: boolean }> {
		const repository = this.dataSource.getRepository(EverWorksInboundEvent);
		// Per aggregate, the earliest event not yet settled — due or not, in this batch or not. A later event
		// never overtakes it: an aggregate whose batch does not start there waits for it.
		const earliest = new Map<string, string>();
		const rows = await repository
			.createQueryBuilder('e')
			.select('e.aggregateType', 'aggregateType')
			.addSelect('e.aggregateId', 'aggregateId')
			.addSelect('MIN(e.seq)', 'minSeq')
			.where('e.connectionId = :connectionId', { connectionId: connection.id })
			.andWhere('e.status IN (:...unfinished)', { unfinished: UNFINISHED })
			.andWhere('e.aggregateId IN (:...ids)', { ids: [...new Set(due.map((event) => event.aggregateId))] })
			.groupBy('e.aggregateType')
			.addGroupBy('e.aggregateId')
			.getRawMany<{ aggregateType: string; aggregateId: string; minSeq: string | number }>();
		for (const row of rows) earliest.set(`${row.aggregateType}:${row.aggregateId}`, String(row.minSeq));
		const groups = new Map<string, EverWorksInboundEvent[]>();
		for (const event of due) {
			const key = `${event.aggregateType}:${event.aggregateId}`;
			groups.set(key, [...(groups.get(key) ?? []), event]);
		}
		let settled = 0;
		for (const [key, events] of groups) {
			events.sort((a, b) => compareSeq(String(a.seq), String(b.seq)));
			const first = earliest.get(key);
			if (first !== undefined && compareSeq(String(events[0].seq), first) > 0) continue; // an earlier event still waits
			for (const event of events) {
				if (settled >= budget) return { settled, stopped: true };
				if (stillOwner && !(await stillOwner())) return { settled, stopped: true };
				const done = await this.applyOne(connection, event, now, owner);
				if (!done) break; // keep the order: the rest of this aggregate waits
				settled++;
			}
		}
		return { settled, stopped: false };
	}

	/**
	 * Writes an event's outcome. With `owner`, the write happens only while that process holds the
	 * connection's lease (one atomic condition on the connection row), else {@link EverWorksLeaseLostError}.
	 */
	private async settle(connection: EverWorksConnection, eventId: ID, values: Record<string, unknown>, owner: string | undefined): Promise<void> {
		if (!owner) {
			await this.dataSource.getRepository(EverWorksInboundEvent).update({ id: eventId }, values as never);
			return;
		}
		const builder = this.dataSource.createQueryBuilder().update(EverWorksInboundEvent).set(values as never);
		const q = (name: string) => builder.escape(name);
		const connections = q(this.dataSource.getMetadata(EverWorksConnection).tableName);
		const result = await builder
			.where(`${q('id')} = :eventId`, { eventId })
			.andWhere(`EXISTS (SELECT 1 FROM ${connections} lease WHERE lease.${q('id')} = :connectionId AND lease.${q('leaseOwner')} = :owner)`, {
				connectionId: connection.id,
				owner
			})
			.execute();
		if (!result.affected) throw new EverWorksLeaseLostError();
	}

	/** Applies one event; returns false when it must be retried (so its aggregate stops here). */
	private async applyOne(connection: EverWorksConnection, event: EverWorksInboundEvent, now: Date, owner?: string): Promise<boolean> {
		const id = event.id as ID;
		let envelope: EverWorksEventEnvelope;
		try {
			envelope = JSON.parse(event.payload) as EverWorksEventEnvelope;
		} catch {
			await this.settle(connection, id, { status: EverWorksInboundStatus.DEAD, error: 'unreadable payload' }, owner);
			return true;
		}
		if (envelope.origin?.tag === `gauzy:${connection.id}`) {
			await this.settle(connection, id, { status: EverWorksInboundStatus.SKIPPED, error: 'own origin', appliedAt: now }, owner);
			return true;
		}
		if (!event.organizationId) {
			await this.settle(connection, id, { status: EverWorksInboundStatus.SKIPPED, error: 'no mapped Gauzy organization', appliedAt: now }, owner);
			return true;
		}
		const handler = this.handlers.get(event.aggregateType);
		if (!handler) {
			await this.settle(
				connection,
				id,
				{ status: EverWorksInboundStatus.DEFERRED, error: `no handler for ${event.aggregateType} yet`, availableAt: new Date(now.getTime() + INBOUND_DEFER_MS) },
				owner
			);
			return true;
		}
		try {
			const outcome = await EverWorksSyncContext.run({ connectionId: connection.id as ID, eventId: event.eventId }, () =>
				handler.apply(envelope, { connection, event, organizationId: event.organizationId as ID })
			);
			if (outcome.status === 'deferred') {
				await this.settle(
					connection,
					id,
					{ status: EverWorksInboundStatus.DEFERRED, error: outcome.message.slice(0, 2000), availableAt: new Date(now.getTime() + (outcome.retryInMs ?? INBOUND_DEFER_MS)) },
					owner
				);
				return false;
			}
			await this.settle(
				connection,
				id,
				{
					status: outcome.status === 'applied' ? EverWorksInboundStatus.APPLIED : EverWorksInboundStatus.SKIPPED,
					error: outcome.status === 'skipped' ? outcome.message.slice(0, 2000) : null,
					appliedAt: now
				},
				owner
			);
			return true;
		} catch (error) {
			if (error instanceof EverWorksLeaseLostError) throw error;
			const attempts = (event.attempts ?? 0) + 1;
			const dead = attempts >= INBOUND_MAX_ATTEMPTS;
			const reason = error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 2000) : 'error';
			await this.settle(
				connection,
				id,
				{
					status: dead ? EverWorksInboundStatus.DEAD : EverWorksInboundStatus.FAILED,
					attempts,
					error: reason,
					availableAt: new Date(now.getTime() + Math.min(60 * 60_000, 2 ** attempts * 1000))
				},
				owner
			);
			if (dead) {
				await this.log.write({
					tenantId: connection.tenantId as ID,
					organizationId: event.organizationId as ID,
					connectionId: connection.id as ID,
					direction: 'inbound',
					entityType: event.aggregateType,
					ewId: event.aggregateId,
					action: 'dead_letter',
					status: 'error',
					message: reason
				});
				this.logger.warn(`Connection ${connection.id}: event ${event.eventId} is dead after ${attempts} attempts.`);
			}
			return false;
		}
	}
}
