import { RequestContext } from '@gauzy/core';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { RenewPluginSubscriptionCommand } from '../renew-plugin-subscription.command';

@CommandHandler(RenewPluginSubscriptionCommand)
export class RenewPluginSubscriptionCommandHandler implements ICommandHandler<RenewPluginSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	/**
	 * Execute plugin subscription renewal command.
	 *
	 * Business Rules:
	 * 1. Subscription must exist and be accessible by the requesting user
	 * 2. Subscription must be in ACTIVE or EXPIRED status to be renewed
	 * 3. Subscription must have autoRenew enabled
	 * 4. Renewal extends subscription by calculating the next billing period
	 * 5. Updates subscription's status to ACTIVE and sets new endDate
	 * 6. Records renewal metadata for tracking purposes
	 *
	 * @param command - The renewal command with subscription ID
	 * @returns The renewed subscription with updated end date
	 * @throws NotFoundException if subscription doesn't exist
	 * @throws BadRequestException if renewal conditions are not met
	 */
	async execute(command: RenewPluginSubscriptionCommand): Promise<IPluginSubscription> {
		const { id } = command;

		// Get current tenant and organization context
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const subscriberId = RequestContext.currentUserId();

		// Find the existing subscription with proper tenant/organization filtering
		const subscription = await this.pluginSubscriptionService.findOneByIdString(id, {
			where: {
				tenantId,
				...(organizationId && { organizationId }),
				...(subscriberId && { subscriberId })
			},
			relations: ['plan', 'plugin', 'pluginTenant']
		});

		if (!subscription) {
			throw new NotFoundException(`Plugin subscription with ID ${id} not found or access denied`);
		}

		// Validate that the subscription can be renewed using domain method
		if (!subscription.canBeRenewed()) {
			throw new BadRequestException(
				'This subscription cannot be renewed. Either auto-renewal is disabled, ' +
					'subscription status is invalid, or it does not meet renewal criteria.'
			);
		}

		// Calculate new end date based on the subscription plan's billing period
		let newEndDate: Date;
		const billingPeriod = subscription.plan?.billingPeriod || 'monthly';

		try {
			newEndDate = subscription.calculateNextBillingDate(billingPeriod);
		} catch (error) {
			// Fallback to monthly renewal if billing period calculation fails
			const currentEndDate = subscription.endDate || new Date();
			newEndDate = new Date(currentEndDate);
			newEndDate.setMonth(newEndDate.getMonth() + 1);
		}

		// Use domain method to renew subscription (includes validation and business logic)
		try {
			subscription.renew(newEndDate);
		} catch (error) {
			throw new BadRequestException(`Failed to renew subscription: ${error.message}`);
		}

		// Persist the renewed subscription
		const renewedSubscription = await this.pluginSubscriptionService.save(subscription);

		return renewedSubscription;
	}
}
