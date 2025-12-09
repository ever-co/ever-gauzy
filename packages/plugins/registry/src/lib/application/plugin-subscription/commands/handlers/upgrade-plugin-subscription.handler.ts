import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { In } from 'typeorm';
import { PluginSubscriptionService } from '../../../../domain';
import { PluginSubscription } from '../../../../domain/entities';
import { IPluginSubscription, PluginSubscriptionStatus } from '../../../../shared';
import { UpgradePluginSubscriptionCommand } from '../upgrade-plugin-subscription.command';

@CommandHandler(UpgradePluginSubscriptionCommand)
export class UpgradePluginSubscriptionCommandHandler implements ICommandHandler<UpgradePluginSubscriptionCommand> {
	private readonly logger = new Logger(UpgradePluginSubscriptionCommandHandler.name);

	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	/**
	 * Execute plugin subscription upgrade command.
	 *
	 * Business Rules:
	 * 1. Subscription must exist and be accessible by the requesting user
	 * 2. Subscription must be in ACTIVE status to be upgraded
	 * 3. New plan must be different from current plan
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
		const { subscriptionId, newPlanId, tenantId, organizationId, userId } = command;

		// Find the existing subscription with proper tenant/organization filtering
		const subscription = await this.pluginSubscriptionService.findOneByIdString(subscriptionId, {
			where: {
				tenantId,
				...(organizationId && { organizationId }),
				...(userId && { subscriberId: userId })
			},
			relations: ['plan', 'plugin', 'children']
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

		const previousPlanId = subscription.planId;

		// Use domain method to upgrade subscription (includes validation and business logic)
		try {
			subscription.upgradeToPlan(newPlanId);
		} catch (error) {
			throw new BadRequestException(`Failed to upgrade subscription: ${error.message}`);
		}

		// Cascade upgrade to child subscriptions if this is a parent subscription
		const upgradedChildren = await this.upgradeChildSubscriptions(subscription, newPlanId, previousPlanId);

		if (upgradedChildren.length > 0) {
			this.logger.log(
				`Upgraded ${upgradedChildren.length} child subscription(s) for parent subscription ${subscriptionId}`
			);
		}

		// Add upgrade metadata
		subscription.metadata = {
			...subscription.metadata,
			upgradedChildCount: upgradedChildren.length,
			upgradedBy: userId,
			upgradeType: subscription.parentId ? 'child' : 'parent'
		};

		// Persist the upgraded subscription
		const updatedSubscription = await this.pluginSubscriptionService.save(subscription);

		return updatedSubscription;
	}

	/**
	 * Upgrades all active child subscriptions when a parent subscription is upgraded.
	 *
	 * @param subscription - The parent subscription being upgraded
	 * @param newPlanId - The new plan ID to apply to children
	 * @param previousPlanId - The previous plan ID for metadata tracking
	 * @returns Array of upgraded child subscriptions
	 */
	private async upgradeChildSubscriptions(
		subscription: PluginSubscription,
		newPlanId: string,
		previousPlanId?: string
	): Promise<PluginSubscription[]> {
		// Skip if this is a child subscription (no cascade needed)
		if (!subscription.isInherited()) {
			return [];
		}

		// Find all active child subscriptions
		const activeChildren = await this.pluginSubscriptionService.find({
			where: {
				parentId: subscription.id,
				status: In([
					PluginSubscriptionStatus.ACTIVE,
					PluginSubscriptionStatus.TRIAL,
					PluginSubscriptionStatus.PENDING
				])
			}
		});

		if (!activeChildren || activeChildren.length === 0) {
			return [];
		}

		const upgradedChildren: PluginSubscription[] = [];

		for (const child of activeChildren) {
			try {
				// Update child's plan to match parent
				child.planId = newPlanId;
				child.metadata = {
					...child.metadata,
					previousPlanId,
					upgradedByParent: true,
					parentSubscriptionId: subscription.id,
					upgradedAt: new Date().toISOString()
				};
				child.updatedAt = new Date();
				upgradedChildren.push(child);
			} catch (error) {
				this.logger.warn(`Failed to upgrade child subscription ${child.id}: ${error.message}`);
			}
		}

		// Batch save all upgraded children
		if (upgradedChildren.length > 0) {
			await this.pluginSubscriptionService.save(upgradedChildren);
		}

		return upgradedChildren;
	}
}
