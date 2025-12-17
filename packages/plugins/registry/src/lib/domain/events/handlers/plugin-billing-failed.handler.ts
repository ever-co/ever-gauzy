import { PluginSubscriptionStatus } from '@gauzy/contracts';
import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../services/plugin-subscription.service';
import { PluginBillingFailedEvent } from '../plugin-billing-failed.event';

/**
 * Event handler for PluginBillingFailedEvent
 * Handles failed payment scenarios and notifies relevant parties
 */
@EventsHandler(PluginBillingFailedEvent)
export class PluginBillingFailedHandler implements IEventHandler<PluginBillingFailedEvent> {
	private readonly logger = new Logger(PluginBillingFailedHandler.name);

	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	/**
	 * Handles the billing failed event
	 * @param event - The billing failed event
	 */
	async handle(event: PluginBillingFailedEvent): Promise<void> {
		const { billing, reason } = event;

		try {
			this.logger.log(`Handling billing failed event for billing: ${billing.id}`);

			// Get the subscription
			const subscription = await this.pluginSubscriptionService.findOneByIdString(billing.subscriptionId);
			if (!subscription) {
				this.logger.warn(`Subscription not found for billing: ${billing.id}`);
				return;
			}

			// Update subscription metadata with failure information
			const failureCount = (subscription.metadata?.paymentFailureCount || 0) + 1;
			const metadata = {
				...subscription.metadata,
				lastPaymentFailure: new Date().toISOString(),
				lastPaymentFailureReason: reason,
				paymentFailureCount: failureCount
			};

			// Suspend subscription after 3 failed attempts
			if (failureCount >= 3) {
				await this.pluginSubscriptionService.update(billing.subscriptionId, {
					status: PluginSubscriptionStatus.SUSPENDED,
					metadata: {
						...metadata,
						suspendedAt: new Date().toISOString(),
						suspensionReason: 'multiple_payment_failures'
					} as any
				});
				this.logger.warn(
					`Suspended subscription ${billing.subscriptionId} after ${failureCount} failed payments`
				);

				// TODO: Send suspension notification email
			} else {
				await this.pluginSubscriptionService.update(billing.subscriptionId, {
					metadata: metadata as any
				});
				this.logger.log(`Updated subscription ${billing.subscriptionId} with failure count: ${failureCount}`);

				// TODO: Send payment failure notification email
			}

			// TODO: Trigger retry logic for payment
			// TODO: Log to monitoring/analytics system

			this.logger.log(`Successfully handled billing failed event for billing: ${billing.id}`);
		} catch (error) {
			this.logger.error(
				`Error handling billing failed event for billing ${billing.id}: ${error.message}`,
				error.stack
			);
		}
	}
}
