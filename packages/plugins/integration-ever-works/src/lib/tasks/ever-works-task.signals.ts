import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';
import { DataSource, EventSubscriber } from 'typeorm';
import { BaseEntityEnum, EntitySubscriptionTypeEnum, ID } from '@gauzy/contracts';
import { BaseEntityEventSubscriber, Comment, EntitySubscription, RequestContext, TaskLinkedIssue } from '@gauzy/core';
import { EverWorksEntityLink, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
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

/**
 * A Gauzy comment was written, edited or deleted. An edit is a partial save (the id and the changed fields,
 * often not the comment's task), so what is missing is read when the signal is drained.
 */
export interface EverWorksCommentSignal {
	tenantId?: ID;
	organizationId?: ID;
	entity?: string;
	commentId: ID;
	deleted: boolean;
	actorUserId: ID | null;
}

/** Outbound trigger 2 for task comments (Gauzy has no comment event the plugin can use). */
export const EVER_WORKS_COMMENT_SIGNALS = new Subject<EverWorksCommentSignal>();

/** A comment on a task: written, edited (also resolved), soft-deleted or deleted. */
@EventSubscriber()
export class EverWorksTaskCommentSubscriber extends BaseEntityEventSubscriber<Comment> {
	override listenTo() {
		return Comment;
	}

	private changed(entity: Comment | undefined, deleted: boolean): void {
		// Loop guard level 1: what the inbound applier writes (synced chat, the sync's own notes) is never captured.
		if (EverWorksSyncContext.isApplying()) return;
		if (!entity?.id || (entity.entity !== undefined && entity.entity !== BaseEntityEnum.Task)) return;
		let actorUserId: ID | null = null;
		try {
			actorUserId = (RequestContext.currentUserId() as ID) ?? null;
		} catch {
			actorUserId = null;
		}
		EVER_WORKS_COMMENT_SIGNALS.next({
			tenantId: (entity.tenantId as ID) ?? undefined,
			organizationId: (entity.organizationId as ID) ?? undefined,
			entity: entity.entity,
			commentId: entity.id as ID,
			deleted,
			actorUserId
		});
	}

	override async afterEntityCreate(entity: Comment): Promise<void> {
		this.changed(entity, false);
	}

	override async afterEntityUpdate(entity: Comment): Promise<void> {
		this.changed(entity, false);
	}

	override async afterEntitySoftRemove(entity: Comment): Promise<void> {
		this.changed(entity, true);
	}

	override async afterEntityDelete(entity: Comment): Promise<void> {
		this.changed(entity, true);
	}
}

/** Drains the task edge and comment signals into the outbound queue. */
@Injectable()
export class EverWorksTaskEdgeCapture implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('EverWorksTasks');
	private subscription: Subscription | null = null;

	constructor(
		private readonly queue: EverWorksOutboundQueue,
		private readonly dataSource: DataSource
	) {}

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
		this.subscription.add(
			EVER_WORKS_COMMENT_SIGNALS.subscribe((change) => {
				void this.resolve(change)
					.then((scope) =>
						scope
							? this.queue.enqueue({
									tenantId: scope.tenantId,
									organizationId: scope.organizationId,
									entityType: EverWorksLinkType.COMMENT,
									gauzyId: change.commentId,
									op: scope.deleted ? 'delete' : 'upsert',
									actorUserId: change.actorUserId
								})
							: false
					)
					.catch((error) => this.logger.warn(`A comment change could not be queued (${error instanceof Error ? error.name : 'error'}).`));
			})
		);
	}

	/**
	 * The tenant and organization of a comment change: from the signal, else from the comment row, else (a
	 * hard delete: the row is gone) from the comment's link. `null` for a comment that is not on a task.
	 */
	private async resolve(change: EverWorksCommentSignal): Promise<{ tenantId: ID; organizationId: ID; deleted: boolean } | null> {
		if (change.tenantId && change.organizationId && change.entity === BaseEntityEnum.Task) {
			return { tenantId: change.tenantId, organizationId: change.organizationId, deleted: change.deleted };
		}
		const row = await this.dataSource.getRepository(Comment).findOne({ where: { id: change.commentId } as never, withDeleted: true });
		if (row) {
			if (row.entity !== BaseEntityEnum.Task || !row.tenantId || !row.organizationId) return null;
			return { tenantId: row.tenantId as ID, organizationId: row.organizationId as ID, deleted: change.deleted || !!(row as { deletedAt?: Date | null }).deletedAt };
		}
		const link = await this.dataSource.getRepository(EverWorksEntityLink).findOne({ where: { entityType: EverWorksLinkType.COMMENT, gauzyId: change.commentId } as never });
		return link?.tenantId && link.organizationId ? { tenantId: link.tenantId as ID, organizationId: link.organizationId as ID, deleted: true } : null;
	}

	onModuleDestroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
	}
}
