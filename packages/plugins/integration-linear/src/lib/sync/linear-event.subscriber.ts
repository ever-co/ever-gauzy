import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ID } from '@gauzy/contracts';
import { BaseEntityEventTypeEnum, EventBus, RequestContext, TaskEvent } from '@gauzy/core';
import { LinearSyncService } from './linear-sync.service';

/**
 * Sends a task's creation or change to Linear when its project is mapped outbound. The platform's
 * `TaskEvent` fires for the tasks people and integrations save with `triggeredEvent` on; the sync's own
 * inbound writes fire none, so an issue that came in is never sent back. The event may carry only the
 * fields that changed (a status change from the board), so the sync reads the saved task again by id.
 */
@Injectable()
export class LinearEventSubscriber implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(LinearEventSubscriber.name);
	private readonly onDestroy$ = new Subject<void>();

	constructor(private readonly eventBus: EventBus, private readonly sync: LinearSyncService) {}

	onModuleInit(): void {
		this.eventBus
			.ofType(TaskEvent)
			.pipe(takeUntil(this.onDestroy$))
			.subscribe((event: TaskEvent) => {
				if (event.type !== BaseEntityEventTypeEnum.CREATED && event.type !== BaseEntityEventTypeEnum.UPDATED) return;
				const entity = event.entity as { id?: ID; tenantId?: ID } | undefined;
				const input = (event.input ?? {}) as { tenantId?: ID };
				const taskId = entity?.id;
				const tenantId = (RequestContext.currentTenantId() ?? entity?.tenantId ?? input.tenantId) as ID | undefined;
				if (!taskId || !tenantId) return;
				// Best effort beside the task's own save: a failure is logged by the sync, never thrown here.
				void this.sync.pushTask(taskId, tenantId).catch((error: unknown) => {
					this.logger.warn(`A task change could not be sent to Linear: ${error instanceof Error ? error.message : String(error)}`);
				});
			});
	}

	onModuleDestroy(): void {
		this.onDestroy$.next();
		this.onDestroy$.complete();
	}
}
