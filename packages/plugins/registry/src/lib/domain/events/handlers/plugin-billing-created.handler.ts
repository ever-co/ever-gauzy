import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../services/plugin-subscription.service';
import { PluginBillingCreatedEvent } from '../plugin-billing-created.event';

/**
 * Event handler for PluginBillingCreatedEvent
 * Handles post-creation actions when a billing record is created
 */
@EventsHandler(PluginBillingCreatedEvent)
export class PluginBillingCreatedHandler implements IEventHandler<PluginBillingCreatedEvent> {
	private readonly logger = new Logger(PluginBillingCreatedHandler.name);

	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	/**
	 * Handles the billing created event
	 * @param event - The billing created event
	 */
	async handle(event: PluginBillingCreatedEvent): Promise<void> {
		const { billing } = event;

		try {
			this.logger.log(`Handling billing created event for billing: ${billing.id}`);

			// Update subscription metadata with latest billing information
			const subscription = await this.pluginSubscriptionService.findOneByIdString(billing.subscriptionId);
			if (subscription) {
				await this.pluginSubscriptionService.update(billing.subscriptionId, {
					metadata: {
						...subscription.metadata,
						lastBillingId: billing.id,
						lastBillingDate: billing.billingDate,
						lastBillingAmount: billing.amount
					} as any
				});
			}

			this.logger.log(`Successfully handled billing created event for billing: ${billing.id}`);
		} catch (error) {
			this.logger.error(
				`Error handling billing created event for billing ${billing.id}: ${error.message}`,
				error.stack
			);
			// Don't throw error to prevent breaking the event flow
		}
	}
}
