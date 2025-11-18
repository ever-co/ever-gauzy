import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { DowngradePluginSubscriptionCommand } from '../downgrade-plugin-subscription.command';

@CommandHandler(DowngradePluginSubscriptionCommand)
export class DowngradePluginSubscriptionCommandHandler implements ICommandHandler<DowngradePluginSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	/**
	 * Execute plugin subscription downgrade command.
	 *
	 * Business Rules:
	 * 1. Subscription must exist and be accessible by the requesting user
	 * 2. Subscription must be in ACTIVE status to be downgraded
	 * 3. New plan must be different from current plan
	 * 4. Downgrade sets metadata tracking previous plan and downgrade timestamp
	 * 5. Updates subscription's planId and updatedAt timestamp
	 * 6. Downgrade may trigger prorated refund calculations (handled in metadata)
	 *
	 * @param command - The downgrade command with subscription and plan details
	 * @returns The updated subscription with new plan
	 * @throws NotFoundException if subscription doesn't exist
	 * @throws BadRequestException if downgrade conditions are not met
	 */
	async execute(command: DowngradePluginSubscriptionCommand): Promise<IPluginSubscription> {
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

		// Validate that the new plan is different from current plan
		if (subscription.planId === newPlanId) {
			throw new BadRequestException('Cannot downgrade to the same plan. Please select a different plan.');
		}

		if (!subscription.canBeDowngraded()) {
			throw new BadRequestException('This subscription cannot be downgraded due to plan restrictions.');
		}

		// Use domain method to downgrade subscription (includes validation and business logic)
		try {
			subscription.downgradeToPlan(newPlanId);
		} catch (error) {
			throw new BadRequestException(`Failed to downgrade subscription: ${error.message}`);
		}

		// Persist the downgraded subscription
		const updatedSubscription = await this.pluginSubscriptionService.save(subscription);

		return updatedSubscription;
	}
}
