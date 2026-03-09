import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Subscription, tap, filter, catchError, EMPTY } from 'rxjs';
import { EventBus, ScreenshotEvent } from '@gauzy/core';
import { SimService } from '../sim.service';

@Injectable()
export class SimScreenshotEventHandler implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(SimScreenshotEventHandler.name);
	private subscription!: Subscription;

	constructor(
		private readonly eventBus: EventBus,
		private readonly simService: SimService
	) {}

	onModuleInit(): void {
		this.subscription = this.eventBus
			.ofType(ScreenshotEvent)
			.pipe(
				filter((event: ScreenshotEvent) => !!event.entity),
				tap((event: ScreenshotEvent) => this.handleScreenshotEvent(event)),
				catchError((error) => {
					this.logger.error('Error in ScreenshotEvent subscription', error?.message);
					return EMPTY;
				})
			)
			.subscribe();
	}

	/**
	 * Handles ScreenshotEvent by triggering any SIM workflow mapped to the corresponding screenshot event type.
	 * Maps screenshot event types to SIM event names:
	 *   - 'created'  -> 'screenshot.created'
	 *   - 'updated'  -> 'screenshot.updated'
	 *   - 'deleted'  -> 'screenshot.deleted'
	 */
	private async handleScreenshotEvent(event: ScreenshotEvent): Promise<void> {
		try {
			const { entity, type } = event;
			const tenantId = entity?.tenantId;
			const organizationId = entity?.organizationId;

			if (!tenantId || !organizationId) {
				return;
			}

			const simEventName = `screenshot.${type}`;

			await this.simService.triggerEventWorkflow({
				event: simEventName,
				data: {
					id: entity.id,
					tenantId: entity.tenantId,
					organizationId: entity.organizationId,
					type
				},
				tenantId,
				organizationId
			});
		} catch (error: any) {
			this.logger.error('Failed to handle ScreenshotEvent for SIM workflow trigger', {
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
