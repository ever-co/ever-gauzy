import { RequestContext } from '@gauzy/core';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { In } from 'typeorm';
import { PluginSubscriptionService } from '../../../../domain';
import { PluginSubscription } from '../../../../domain/entities';
import { IPluginSubscription, PluginSubscriptionStatus } from '../../../../shared';
import { CancelPluginSubscriptionCommand } from '../cancel-plugin-subscription.command';

@CommandHandler(CancelPluginSubscriptionCommand)
export class CancelPluginSubscriptionCommandHandler implements ICommandHandler<CancelPluginSubscriptionCommand> {
	private readonly logger = new Logger(CancelPluginSubscriptionCommandHandler.name);

	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	/**
	 * Execute plugin subscription cancellation command.
	 *
	 * Business Rules:
	 * 1. Subscription must exist and be accessible by the requesting user
	 * 2. Subscription must not already be cancelled
	 * 3. Cancellation sets status to CANCELLED and records cancellation timestamp and reason
	 * 4. Sets autoRenew to false to prevent future renewals
	 * 5. Updates subscription's updatedAt timestamp
	 * 6. Parent subscription cancellation cascades to all active child subscriptions
	 * 7. Child subscription cancellation does NOT affect parent or sibling subscriptions
	 * 8. Cancellation may trigger prorated refund calculations (handled elsewhere)
	 *
	 * @param command - The cancellation command with subscription ID and optional reason
	 * @returns The updated cancelled subscription
	 * @throws NotFoundException if subscription doesn't exist
	 * @throws BadRequestException if cancellation conditions are not met
	 */
	async execute(command: CancelPluginSubscriptionCommand): Promise<IPluginSubscription> {
		const { id, reason } = command;

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
			relations: ['plan', 'plugin', 'pluginTenant', 'children']
		});

		if (!subscription) {
			throw new NotFoundException(`Plugin subscription with ID ${id} not found or access denied`);
		}

		// Validate that the subscription can be cancelled using domain method
		if (!subscription.canBeCancelled()) {
			throw new BadRequestException('This subscription cannot be cancelled as it is already cancelled');
		}

		// Use domain method to cancel subscription (includes validation and business logic)
		try {
			subscription.cancel(reason);
		} catch (error) {
			throw new BadRequestException(`Failed to cancel subscription: ${error.message}`);
		}

		// Cascade cancellation to child subscriptions if this is a parent subscription
		const cancelledChildren = await this.cancelChildSubscriptions(subscription, reason);

		if (cancelledChildren.length > 0) {
			this.logger.log(
				`Cancelled ${cancelledChildren.length} child subscription(s) for parent subscription ${id}`
			);
		}

		// Persist the cancelled subscription
		const cancelledSubscription = await this.pluginSubscriptionService.save(subscription);

		// Add cancellation metadata
		cancelledSubscription.metadata = {
			...cancelledSubscription.metadata,
			cancelledChildCount: cancelledChildren.length,
			cancelledBy: subscriberId,
			cancellationType: subscription.parentId ? 'child' : 'parent'
		};

		await this.pluginSubscriptionService.save(cancelledSubscription);

		return cancelledSubscription;
	}

	/**
	 * Cancels all active child subscriptions when a parent subscription is cancelled.
	 *
	 * @param parentSubscription - The parent subscription being cancelled
	 * @param reason - The cancellation reason to propagate to children
	 * @returns Array of cancelled child subscriptions
	 */
	private async cancelChildSubscriptions(
		parentSubscription: PluginSubscription,
		reason?: string
	): Promise<PluginSubscription[]> {
		// Skip if this is a child subscription (no cascade needed)
		if (!parentSubscription.isInheritedSubscription()) {
			return [];
		}

		// Find all active child subscriptions
		const activeChildren = await this.pluginSubscriptionService.find({
			where: {
				parentId: parentSubscription.id,
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

		const cancelledChildren: PluginSubscription[] = [];
		const cascadeReason = reason ? `Parent subscription cancelled: ${reason}` : 'Parent subscription cancelled';

		for (const child of activeChildren) {
			if (child.canBeCancelled()) {
				try {
					child.cancel(cascadeReason);
					child.metadata = {
						...child.metadata,
						cancelledByParent: true,
						parentSubscriptionId: parentSubscription.id,
						parentCancellationReason: reason
					};
					cancelledChildren.push(child);
				} catch (error) {
					this.logger.warn(`Failed to cancel child subscription ${child.id}: ${error.message}`);
				}
			}
		}

		// Batch save all cancelled children
		if (cancelledChildren.length > 0) {
			await this.pluginSubscriptionService.save(cancelledChildren);
		}

		return cancelledChildren;
	}
}
