import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Subscription, filter, catchError, EMPTY, concatMap, from } from 'rxjs';
import { EventBus, IntegrationEvent } from '@gauzy/core';
import { SimService } from '../sim.service';

@Injectable()
export class SimIntegrationEventHandler implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(SimIntegrationEventHandler.name);
	private subscription!: Subscription;

	constructor(
		private readonly eventBus: EventBus,
		private readonly simService: SimService
	) {}

	onModuleInit(): void {
		this.subscription = this.eventBus
			.ofType(IntegrationEvent)
			.pipe(
				filter((event: IntegrationEvent) => !!event.entity),
				concatMap((event: IntegrationEvent) =>
					from(this.handleIntegrationEvent(event)).pipe(
						catchError((error) => {
							this.logger.error('Error in IntegrationEvent subscription', error?.message);
							return EMPTY;
						})
					)
				)
			)
			.subscribe();
	}

	/**
	 * Handles IntegrationEvent by triggering any SIM workflow mapped to the corresponding integration event type.
	 * Maps integration event types to SIM event names:
	 *   - 'created'  -> 'integration.created'
	 *   - 'updated'  -> 'integration.updated'
	 *   - 'deleted'  -> 'integration.deleted'
	 */
	private async handleIntegrationEvent(event: IntegrationEvent): Promise<void> {
		try {
			const { entity, type } = event;
			const tenantId = entity?.tenantId;
			const organizationId = entity?.organizationId;

			if (!tenantId || !organizationId) {
				return;
			}

			const simEventName = `integration.${type}`;

			await this.simService.triggerEventWorkflow({
				event: simEventName,
				data: {
					id: entity.id,
					name: entity.name,
					tenantId: entity.tenantId,
					organizationId: entity.organizationId,
					type
				},
				tenantId,
				organizationId
			});
		} catch (error: any) {
			this.logger.error('Failed to handle IntegrationEvent for SIM workflow trigger', {
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
