import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';
import { EventSubscriber } from 'typeorm';
import { BaseEntityEnum, EntitySubscriptionTypeEnum, ID } from '@gauzy/contracts';
import { BaseEntityEventSubscriber, EntitySubscription, RequestContext, TaskLinkedIssue } from '@gauzy/core';
import { EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import { EverWorksOutboundQueue } from '../sync/outbound/ever-works-outbound.queue';

/** A Gauzy task's watchers or linked issues changed. */
export interface EverWorksTaskSignal {
	tenantId: ID;
	organizationId: ID;
	taskId: ID;
	actorUserId: ID | null;
}

/**
 * Outbound trigger 2 (plan 03 §C.2) for task edges: watchers (`EntitySubscription` of type `manual` on a
 * task) and linked issues change without a `TaskEvent`. Entity subscribers are created by the ORM, outside
 * Nest, so they signal through this static subject, which {@link EverWorksTaskEdgeCapture} drains into the
 * queue (one coalesced `TASK` change per task). Bulk deletes the hooks cannot see are caught by the sweep.
 */
export const EVER_WORKS_TASK_SIGNALS = new Subject<EverWorksTaskSignal>();

function signal(row: { tenantId?: ID; organizationId?: ID } | undefined, taskIds: ReadonlyArray<ID | undefined>): void {
	// Loop guard level 1: what the inbound applier writes is never captured.
	if (EverWorksSyncContext.isApplying()) return;
	if (!row?.tenantId || !row.organizationId) return;
	let actorUserId: ID | null = null;
	try {
		actorUserId = (RequestContext.currentUserId() as ID) ?? null;
	} catch {
		actorUserId = null;
	}
	for (const taskId of new Set(taskIds)) {
		if (taskId) EVER_WORKS_TASK_SIGNALS.next({ tenantId: row.tenantId, organizationId: row.organizationId, taskId, actorUserId });
	}
}

/** A watcher added or removed (only `manual` subscriptions to a task are watchers). */
@EventSubscriber()
export class EverWorksTaskWatcherSubscriber extends BaseEntityEventSubscriber<EntitySubscription> {
	override listenTo() {
		return EntitySubscription;
	}

	private changed(entity: EntitySubscription | undefined): void {
		if (entity?.entity !== BaseEntityEnum.Task || entity.type !== EntitySubscriptionTypeEnum.MANUAL) return;
		signal(entity, [entity.entityId as ID]);
	}

	override async afterEntityCreate(entity: EntitySubscription): Promise<void> {
		this.changed(entity);
	}

	override async afterEntityUpdate(entity: EntitySubscription): Promise<void> {
		this.changed(entity);
	}

	override async afterEntitySoftRemove(entity: EntitySubscription): Promise<void> {
		this.changed(entity);
	}

	override async afterEntityDelete(entity: EntitySubscription): Promise<void> {
		this.changed(entity);
	}
}

/** A linked issue added, changed or removed: both of its tasks may have new blockers or relations. */
@EventSubscriber()
export class EverWorksTaskLinkedIssueSubscriber extends BaseEntityEventSubscriber<TaskLinkedIssue> {
	override listenTo() {
		return TaskLinkedIssue;
	}

	override async afterEntityCreate(entity: TaskLinkedIssue): Promise<void> {
		signal(entity, [entity?.taskToId as ID, entity?.taskFromId as ID]);
	}

	override async afterEntityUpdate(entity: TaskLinkedIssue): Promise<void> {
		signal(entity, [entity?.taskToId as ID, entity?.taskFromId as ID]);
	}

	override async afterEntitySoftRemove(entity: TaskLinkedIssue): Promise<void> {
		signal(entity, [entity?.taskToId as ID, entity?.taskFromId as ID]);
	}

	override async afterEntityDelete(entity: TaskLinkedIssue): Promise<void> {
		signal(entity, [entity?.taskToId as ID, entity?.taskFromId as ID]);
	}
}

/** Drains the task edge signals into the outbound queue. */
@Injectable()
export class EverWorksTaskEdgeCapture implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('EverWorksTasks');
	private subscription: Subscription | null = null;

	constructor(private readonly queue: EverWorksOutboundQueue) {}

	onModuleInit(): void {
		this.subscription = EVER_WORKS_TASK_SIGNALS.subscribe((change) => {
			void this.queue
				.enqueue({
					tenantId: change.tenantId,
					organizationId: change.organizationId,
					entityType: EverWorksLinkType.TASK,
					gauzyId: change.taskId,
					op: 'upsert',
					actorUserId: change.actorUserId
				})
				.catch((error) => this.logger.warn(`A task change could not be queued (${error instanceof Error ? error.name : 'error'}).`));
		});
	}

	onModuleDestroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
	}
}
