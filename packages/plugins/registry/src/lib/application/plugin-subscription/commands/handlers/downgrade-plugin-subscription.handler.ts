import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { In } from 'typeorm';
import { PluginSubscriptionService } from '../../../../domain';
import { PluginSubscription } from '../../../../domain/entities';
import { IPluginSubscription, PluginSubscriptionStatus } from '../../../../shared';
import { DowngradePluginSubscriptionCommand } from '../downgrade-plugin-subscription.command';

@CommandHandler(DowngradePluginSubscriptionCommand)
export class DowngradePluginSubscriptionCommandHandler implements ICommandHandler<DowngradePluginSubscriptionCommand> {
	private readonly logger = new Logger(DowngradePluginSubscriptionCommandHandler.name);

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
	 * 7. Parent subscription downgrade cascades plan change to all active child subscriptions
	 * 8. Child subscription downgrade does NOT affect parent or sibling subscriptions
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
			relations: ['plan', 'plugin', 'children']
		});

		if (!subscription) {
			throw new NotFoundException(`Plugin subscription with ID ${subscriptionId} not found or access denied`);
		}

		// Ensure the user can only downgrade their own subscription
		if (userId && subscription.subscriberId && subscription.subscriberId !== userId) {
			throw new BadRequestException('You can only downgrade your own subscriptions');
		}

		// Validate that the new plan is different from current plan
		if (subscription.planId === newPlanId) {
			throw new BadRequestException('Cannot downgrade to the same plan. Please select a different plan.');
		}

		if (!subscription.canBeDowngraded()) {
			throw new BadRequestException('This subscription cannot be downgraded due to plan restrictions.');
		}

		const previousPlanId = subscription.planId;

		// Use domain method to downgrade subscription (includes validation and business logic)
		try {
			subscription.downgradeToPlan(newPlanId);
		} catch (error) {
			throw new BadRequestException(`Failed to downgrade subscription: ${error.message}`);
		}

		// Cascade downgrade to child subscriptions if this is a parent subscription
		const downgradedChildren = await this.downgradeChildSubscriptions(subscription, newPlanId, previousPlanId);

		if (downgradedChildren.length > 0) {
			this.logger.log(
				`Downgraded ${downgradedChildren.length} child subscription(s) for parent subscription ${subscriptionId}`
			);
		}

		// Add downgrade metadata
		subscription.metadata = {
			...subscription.metadata,
			downgradedChildCount: downgradedChildren.length,
			downgradedBy: userId,
			downgradeType: subscription.parentId ? 'child' : 'parent'
		};

		// Persist the downgraded subscription
		const updatedSubscription = await this.pluginSubscriptionService.save(subscription);

		return updatedSubscription;
	}

	/**
	 * Downgrades all active child subscriptions when a parent subscription is downgraded.
	 *
	 * @param subscription - The parent subscription being downgraded
	 * @param newPlanId - The new plan ID to apply to children
	 * @param previousPlanId - The previous plan ID for metadata tracking
	 * @returns Array of downgraded child subscriptions
	 */
	private async downgradeChildSubscriptions(
		subscription: PluginSubscription,
		newPlanId: string,
		previousPlanId?: string
	): Promise<PluginSubscription[]> {
		// Skip if this is a child subscription (no cascade needed)
		if (!subscription.isInheritedSubscription()) {
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

		const downgradedChildren: PluginSubscription[] = [];

		for (const child of activeChildren) {
			try {
				// Update child's plan to match parent
				child.planId = newPlanId;
				child.metadata = {
					...child.metadata,
					previousPlanId,
					downgradedByParent: true,
					parentSubscriptionId: subscription.id,
					downgradedAt: new Date().toISOString()
				};
				child.updatedAt = new Date();
				downgradedChildren.push(child);
			} catch (error) {
				this.logger.warn(`Failed to downgrade child subscription ${child.id}: ${error.message}`);
			}
		}

		// Batch save all downgraded children
		if (downgradedChildren.length > 0) {
			await this.pluginSubscriptionService.save(downgradedChildren);
		}

		return downgradedChildren;
	}
}
