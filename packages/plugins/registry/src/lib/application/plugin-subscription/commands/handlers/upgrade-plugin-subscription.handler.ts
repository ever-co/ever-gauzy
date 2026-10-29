import { BadRequestException, HttpException, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginService, PluginSubscriptionPlanService, PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { UpgradePluginSubscriptionCommand } from '../upgrade-plugin-subscription.command';
import { assertPlanChangeAllowed } from './plan-change';

@CommandHandler(UpgradePluginSubscriptionCommand)
export class UpgradePluginSubscriptionCommandHandler implements ICommandHandler<UpgradePluginSubscriptionCommand> {
	private readonly logger = new Logger(UpgradePluginSubscriptionCommandHandler.name);

	constructor(
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService,
		private readonly pluginService: PluginService
	) {}

	/**
	 * Execute plugin subscription upgrade command.
	 *
	 * Business Rules:
	 * 1. Subscription must exist and be accessible by the requesting user
	 * 2. Subscription must be in ACTIVE status to be upgraded
	 * 3. New plan must be different from current plan, active, of the subscription's plugin, and cost no more unless
	 *    the plugin's publisher makes the change ({@link assertPlanChangeAllowed})
	 * 4. Upgrade sets metadata tracking previous plan and upgrade timestamp
	 * 5. Updates subscription's planId and updatedAt timestamp
	 * 6. Parent subscription upgrade cascades plan change to all active child subscriptions
	 * 7. Child subscription upgrade does NOT affect parent or sibling subscriptions
	 *
	 * @param command - The upgrade command with subscription and plan details
	 * @returns The updated subscription with new plan
	 * @throws NotFoundException if subscription doesn't exist
	 * @throws BadRequestException if upgrade conditions are not met
	 */
	async execute(command: UpgradePluginSubscriptionCommand): Promise<IPluginSubscription> {
		const { subscriptionId, newPlanId, tenantId, organizationId, userId, pluginId } = command;
		try {
			// Find the existing subscription with proper tenant/organization filtering
			const { record: subscription, success } = await this.pluginSubscriptionService.findOneOrFailByIdString(
				subscriptionId,
				{
					where: {
						tenantId,
						...(organizationId && { organizationId }),
						...(userId && { subscriberId: userId })
					},
					relations: ['plan', 'plugin', 'parent', 'children']
				}
			);

			if (!success) {
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

			await assertPlanChangeAllowed(
				this.pluginSubscriptionPlanService,
				this.pluginService,
				subscription,
				newPlanId,
				pluginId
			);

			// Use domain method to upgrade subscription (includes validation and business logic)
			const upgradedSubscription = subscription.upgradeToPlan(newPlanId);

			// Cascade upgrade to child subscriptions if this is a parent subscription
			const upgradedChildren = this.upgradeChildSubscriptions(upgradedSubscription);

			if (upgradedChildren.length > 0) {
				this.logger.log(
					`Upgraded ${upgradedChildren.length} child subscription(s) for parent subscription ${subscriptionId}`
				);
			}

			// Add upgrade metadata
			upgradedSubscription.metadata = {
				...upgradedSubscription.metadata,
				upgradedChildCount: upgradedChildren.length,
				upgradedBy: userId,
				upgradeType: upgradedSubscription.parentId ? 'child' : 'parent'
			};

			// Persist the upgraded subscription
			return this.pluginSubscriptionService.save(upgradedSubscription);
		} catch (error) {
			// A refusal keeps its own status (404, 402…); anything else is reported as a failed upgrade.
			if (error instanceof HttpException) {
				throw error;
			}
			throw new BadRequestException(`Failed to upgrade subscription: ${error.message}`);
		}
	}

	/**
	 * Upgrades all active child subscriptions when a parent subscription is upgraded.
	 *
	 * @param subscription - The parent subscription being upgraded
	 * @param newPlanId - The new plan ID to apply to children
	 * @param previousPlanId - The previous plan ID for metadata tracking
	 * @returns Array of upgraded child subscriptions
	 */
	private upgradeChildSubscriptions(subscription: IPluginSubscription): IPluginSubscription[] {
		// Skip if this is a child subscription (no cascade needed)
		if (subscription.isInherited()) return [];
		// Upgrade all children
		return subscription.children.map((child: IPluginSubscription) => child.upgradeToPlan(subscription.planId));
	}
}
