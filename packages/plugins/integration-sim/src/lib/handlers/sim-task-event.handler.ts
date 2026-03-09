import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Subscription, filter, catchError, EMPTY, concatMap, from } from 'rxjs';
import { EventBus, TaskEvent } from '@gauzy/core';
import { SimService } from '../sim.service';
import { SimEventName, SimEventType } from '../dto/event-mapping.dto';

/** Map BaseEntityEventType to SimEventName keys */
const TASK_EVENT_MAP: Record<string, SimEventType> = {
	created: SimEventName.TASK_CREATED,
	updated: SimEventName.TASK_UPDATED,
	deleted: SimEventName.TASK_DELETED
};

@Injectable()
export class SimTaskEventHandler implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(SimTaskEventHandler.name);
	private subscription!: Subscription;

	constructor(
		private readonly eventBus: EventBus,
		private readonly simService: SimService
	) {}

	onModuleInit(): void {
		this.subscription = this.eventBus
			.ofType(TaskEvent)
			.pipe(
				filter((event: TaskEvent) => !!event.entity),
				concatMap((event: TaskEvent) =>
					from(this.handleTaskEvent(event)).pipe(
						catchError((error) => {
							this.logger.error('Error in TaskEvent subscription', error?.message);
							return EMPTY;
						})
					)
				)
			)
			.subscribe();
	}

	/**
	 * Handles TaskEvent by triggering any SIM workflow mapped to the corresponding task event type.
	 * Maps task event types to SIM event names:
	 *   - 'created'  -> 'task.created'
	 *   - 'updated'  -> 'task.updated'
	 *   - 'deleted'  -> 'task.deleted'
	 */
	private async handleTaskEvent(event: TaskEvent): Promise<void> {
		try {
			const { entity, type } = event;
			const tenantId = entity?.tenantId;
			const organizationId = entity?.organizationId;

			if (!tenantId || !organizationId) {
				return;
			}

			const simEventName = TASK_EVENT_MAP[type];
			if (!simEventName) return;

			await this.simService.triggerEventWorkflow({
				event: simEventName,
				data: {
					id: entity.id,
					title: entity.title,
					status: entity.status,
					projectId: entity.projectId,
					tenantId: entity.tenantId,
					organizationId: entity.organizationId,
					type
				},
				tenantId,
				organizationId
			});
		} catch (error: any) {
			this.logger.error('Failed to handle TaskEvent for SIM workflow trigger', {
				message: error?.message,
				stack: error?.stack
			});
		}
	}

	onModuleDestroy(): void {
		if (this.subscription) {
			this.subscription.unsubscribe();
		}
	}
}
