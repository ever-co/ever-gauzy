import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';
import { EventSubscriber } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { BaseEntityEventSubscriber, Goal, KeyResult, KeyResultUpdate, RequestContext } from '@gauzy/core';
import { EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import { EverWorksOutboundQueue } from '../sync/outbound/ever-works-outbound.queue';

/** A Gauzy goal (or one of its key results) changed: a `GOAL` push, or a key result value: a `KEY_RESULT` sample. */
export interface EverWorksGoalSignal {
	tenantId: ID;
	organizationId: ID;
	entityType: EverWorksLinkType.GOAL | EverWorksLinkType.KEY_RESULT;
	gauzyId: ID;
	deleted: boolean;
	actorUserId: ID | null;
}

/**
 * Outbound trigger 2 (plan 03 §C.2) for goals: `Goal`, `KeyResult` and `KeyResultUpdate` subscribers.
 * They are created by the ORM, outside Nest, so they signal through this static subject, which
 * {@link EverWorksGoalCapture} drains into the queue.
 */
export const EVER_WORKS_GOAL_SIGNALS = new Subject<EverWorksGoalSignal>();

function signal(
	row: { tenantId?: ID; organizationId?: ID } | undefined,
	entityType: EverWorksGoalSignal['entityType'],
	gauzyId: ID | undefined,
	deleted = false
): void {
	// Loop guard level 1: what the inbound applier writes is never captured.
	if (EverWorksSyncContext.isApplying()) return;
	if (!row?.tenantId || !row.organizationId || !gauzyId) return;
	let actorUserId: ID | null = null;
	try {
		actorUserId = (RequestContext.currentUserId() as ID) ?? null;
	} catch {
		actorUserId = null;
	}
	EVER_WORKS_GOAL_SIGNALS.next({
		tenantId: row.tenantId,
		organizationId: row.organizationId,
		entityType,
		gauzyId,
		deleted,
		actorUserId
	});
}

/** `Goal` created, edited, archived or deleted. */
@EventSubscriber()
export class EverWorksGoalSubscriber extends BaseEntityEventSubscriber<Goal> {
	override listenTo() {
		return Goal;
	}

	override async afterEntityCreate(entity: Goal): Promise<void> {
		signal(entity, EverWorksLinkType.GOAL, entity?.id as ID);
	}

	override async afterEntityUpdate(entity: Goal): Promise<void> {
		signal(entity, EverWorksLinkType.GOAL, entity?.id as ID);
	}

	override async afterEntitySoftRemove(entity: Goal): Promise<void> {
		signal(entity, EverWorksLinkType.GOAL, entity?.id as ID, true);
	}

	override async afterEntityDelete(entity: Goal): Promise<void> {
		signal(entity, EverWorksLinkType.GOAL, entity?.id as ID, true);
	}
}

/** A key result added, edited or removed: its goal's criteria / Definition of Done, and its value. */
@EventSubscriber()
export class EverWorksKeyResultSubscriber extends BaseEntityEventSubscriber<KeyResult> {
	override listenTo() {
		return KeyResult;
	}

	override async afterEntityCreate(entity: KeyResult): Promise<void> {
		this.both(entity);
	}

	override async afterEntityUpdate(entity: KeyResult): Promise<void> {
		this.both(entity);
	}

	override async afterEntityDelete(entity: KeyResult): Promise<void> {
		signal(entity, EverWorksLinkType.GOAL, entity?.goalId as ID);
	}

	private both(entity: KeyResult): void {
		signal(entity, EverWorksLinkType.GOAL, entity?.goalId as ID);
		signal(entity, EverWorksLinkType.KEY_RESULT, entity?.id as ID);
	}
}

/** A key result update (a new value): pushed as an Ever Works sample. */
@EventSubscriber()
export class EverWorksKeyResultUpdateSubscriber extends BaseEntityEventSubscriber<KeyResultUpdate> {
	override listenTo() {
		return KeyResultUpdate;
	}

	override async afterEntityCreate(entity: KeyResultUpdate): Promise<void> {
		signal(entity, EverWorksLinkType.KEY_RESULT, entity?.keyResultId as ID);
	}
}

/** Drains the goal signals into the outbound queue (one coalesced change per record and type). */
@Injectable()
export class EverWorksGoalCapture implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('EverWorksGoals');
	private subscription: Subscription | null = null;

	constructor(private readonly queue: EverWorksOutboundQueue) {}

	onModuleInit(): void {
		this.subscription = EVER_WORKS_GOAL_SIGNALS.subscribe((change) => {
			void this.queue
				.enqueue({
					tenantId: change.tenantId,
					organizationId: change.organizationId,
					entityType: change.entityType,
					gauzyId: change.gauzyId,
					op: change.deleted ? 'delete' : 'upsert',
					actorUserId: change.actorUserId
				})
				.catch((error) =>
					this.logger.warn(
						`A goal change could not be queued (${error instanceof Error ? error.name : 'error'}).`
					)
				);
		});
	}

	onModuleDestroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
	}
}
