import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { UpgradePluginSubscriptionCommand } from '../upgrade-plugin-subscription.command';

@CommandHandler(UpgradePluginSubscriptionCommand)
export class UpgradePluginSubscriptionCommandHandler implements ICommandHandler<UpgradePluginSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) { }

	/**
	 * Execute plugin subscription upgrade command.
	 *
	 * Business Rules:
	 * 1. Subscription must exist and be accessible by the requesting user
	 * 2. Subscription must be in ACTIVE status to be upgraded
	 * 3. New plan must be different from current plan
	 * 4. Upgrade sets metadata tracking previous plan and upgrade timestamp
	 * 5. Updates subscription's planId and updatedAt timestamp
	 *
	 * @param command - The upgrade command with subscription and plan details
	 * @returns The updated subscription with new plan
	 * @throws NotFoundException if subscription doesn't exist
	 * @throws BadRequestException if upgrade conditions are not met
	 */
	async execute(command: UpgradePluginSubscriptionCommand): Promise<IPluginSubscription> {
		const { subscriptionId, newPlanId, tenantId, organizationId, userId } = command;

		// Find the existing subscription with proper tenant/organization filtering
		const subscription = await this.pluginSubscriptionService.findOneByIdString(subscriptionId, {
			where: {
				tenantId,
				...(organizationId && { organizationId }),
				...(userId && { subscriberId: userId })
			},
			relations: ['plan', 'plugin']
		});

		if (!subscription) {
			throw new NotFoundException(`Plugin subscription with ID ${subscriptionId} not found or access denied`);
		}

		// Ensure the user can only upgrade their own subscription
		if (userId && subscription.subscriberId && subscription.subscriberId !== userId) {
			throw new BadRequestException('You can only upgrade your own subscriptions');
		}

		// Validate that the new plan is different from current plan
		if (subscription.planId === newPlanId) {
			throw new BadRequestException('Cannot upgrade to the same plan. Please select a different plan.');
		}

		// Use domain method to upgrade subscription (includes validation and business logic)
		try {
			subscription.upgradeToPlan(newPlanId);
		} catch (error) {
			throw new BadRequestException(`Failed to upgrade subscription: ${error.message}`);
		}

		// Persist the upgraded subscription
		const updatedSubscription = await this.pluginSubscriptionService.save(subscription);

		return updatedSubscription;
	}
}
