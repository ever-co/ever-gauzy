import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';
import { ID } from '@gauzy/contracts';
import { BaseEntityEventTypeEnum, EventBus, RequestContext, TaskEvent } from '@gauzy/core';
import { EverWorksSyncContext } from '../ever-works-sync.context';
import { EverWorksLinkType } from '../entities/ever-works-sync.entities';
import { EverWorksOutboundQueue } from './ever-works-outbound.queue';
import { runDetached } from './ever-works-detached';

/**
 * Outbound trigger 1 (plan 03 §C.2): Gauzy's `TaskEvent` (created, updated and — with G-P1-1 — deleted)
 * enqueues a task change for the organization's Ever Works mapping. Plane edits arrive as ordinary Gauzy
 * task writes, so they are captured here too.
 *
 * Loop guard level 1: an event published while the inbound applier is writing
 * (`EverWorksSyncContext.isApplying()`) is ignored. The check is synchronous, in the publisher's own
 * asynchronous context (the event bus is an in-process subject).
 */
@Injectable()
export class EverWorksTaskEventListener implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('EverWorksTaskEvents');
	private subscription: Subscription | null = null;
	/** Captured triggers, drained outside the publisher's call stack. */
	private readonly triggers = new Subject<{ tenantId: ID; organizationId: ID; taskId: ID; deleted: boolean; actorUserId: ID | null }>();

	constructor(
		private readonly eventBus: EventBus,
		private readonly queue: EverWorksOutboundQueue
	) {}

	onModuleInit(): void {
		this.subscription = this.eventBus.ofType(TaskEvent).subscribe((event: TaskEvent) => {
			try {
				if (EverWorksSyncContext.isApplying()) return;
				const task = event.entity as { id?: ID; tenantId?: ID; organizationId?: ID } | undefined;
				const input = (event.input ?? {}) as { tenantId?: ID; organizationId?: ID };
				const taskId = task?.id;
				const tenantId = task?.tenantId ?? input.tenantId ?? RequestContext.currentTenantId() ?? undefined;
				const organizationId = task?.organizationId ?? input.organizationId;
				if (!taskId || !tenantId || !organizationId) return;
				this.triggers.next({
					tenantId,
					organizationId,
					taskId,
					deleted: String(event.type) === String((BaseEntityEventTypeEnum as Record<string, string>)['DELETED'] ?? 'deleted'),
					actorUserId: RequestContext.currentUserId() ?? null
				});
			} catch (error) {
				this.logger.warn(`A task event could not be captured (${error instanceof Error ? error.name : 'error'}).`);
			}
		});
		this.subscription.add(
			this.triggers.subscribe((trigger) => {
				// Outside the task write's transaction context (see ever-works-detached.ts).
				void runDetached(() =>
					this.queue.enqueue({
						tenantId: trigger.tenantId,
						organizationId: trigger.organizationId,
						entityType: EverWorksLinkType.TASK,
						gauzyId: trigger.taskId,
						op: trigger.deleted ? 'delete' : 'upsert',
						actorUserId: trigger.actorUserId
					})
				).catch((error) => this.logger.warn(`A task change could not be queued (${error instanceof Error ? error.name : 'error'}).`));
			})
		);
	}

	onModuleDestroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
	}
}
