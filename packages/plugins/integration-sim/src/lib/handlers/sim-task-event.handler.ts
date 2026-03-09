import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Subscription, tap, filter, catchError, EMPTY } from 'rxjs';
import { EventBus, TaskEvent } from '@gauzy/core';
import { SimService } from '../sim.service';

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
				tap((event: TaskEvent) => this.handleTaskEvent(event)),
				catchError((error) => {
					this.logger.error('Error in TaskEvent subscription', error?.message);
					return EMPTY;
				})
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

			const simEventName = `task.${type}`;

			await this.simService.triggerEventWorkflow({
				event: simEventName,
				data: {
					id: entity.id,
					title: entity.title,
					status: entity.status,
					projectId: entity.projectId,
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
