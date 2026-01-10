import { PluginSubscriptionStatus } from '@gauzy/contracts';
import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../services/plugin-subscription.service';
import { PluginBillingPaidEvent } from '../plugin-billing-paid.event';

/**
 * Event handler for PluginBillingPaidEvent
 * Updates subscription status and handles post-payment actions
 */
@EventsHandler(PluginBillingPaidEvent)
export class PluginBillingPaidHandler implements IEventHandler<PluginBillingPaidEvent> {
	private readonly logger = new Logger(PluginBillingPaidHandler.name);

	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	/**
	 * Handles the billing paid event
	 * @param event - The billing paid event
	 */
	async handle(event: PluginBillingPaidEvent): Promise<void> {
		const { billing, paymentReference } = event;

		try {
			this.logger.log(`Handling billing paid event for billing: ${billing.id}`);

			// Get the subscription
			const subscription = await this.pluginSubscriptionService.findOneByIdString(billing.subscriptionId);
			if (!subscription) {
				this.logger.warn(`Subscription not found for billing: ${billing.id}`);
				return;
			}

			// If subscription was suspended due to payment failure, reactivate it
			if (subscription.status === PluginSubscriptionStatus.SUSPENDED) {
				await this.pluginSubscriptionService.update(billing.subscriptionId, {
					status: PluginSubscriptionStatus.ACTIVE,
					metadata: {
						...subscription.metadata,
						reactivatedAt: new Date().toISOString(),
						reactivatedBy: 'payment_success',
						paymentReference
					} as any
				});
				this.logger.log(`Reactivated suspended subscription: ${billing.subscriptionId}`);
			}

			// Update subscription metadata with payment information
			await this.pluginSubscriptionService.update(billing.subscriptionId, {
				metadata: {
					...subscription.metadata,
					lastPaymentDate: new Date().toISOString(),
					lastPaymentAmount: billing.amount,
					lastPaymentReference: paymentReference
				} as any
			});

			// TODO: Send payment confirmation email
			// TODO: Generate invoice/receipt
			// TODO: Update analytics/reporting

			this.logger.log(`Successfully handled billing paid event for billing: ${billing.id}`);
		} catch (error) {
			this.logger.error(
				`Error handling billing paid event for billing ${billing.id}: ${error.message}`,
				error.stack
			);
		}
	}
}
