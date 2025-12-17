import { PluginSubscriptionStatus } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { In } from 'typeorm';
import { PluginSubscriptionService } from '../../../../domain';
import { PluginSubscription } from '../../../../domain/entities';
import { IPluginSubscription } from '../../../../shared';
import { RenewPluginSubscriptionCommand } from '../renew-plugin-subscription.command';

@CommandHandler(RenewPluginSubscriptionCommand)
export class RenewPluginSubscriptionCommandHandler implements ICommandHandler<RenewPluginSubscriptionCommand> {
	private readonly logger = new Logger(RenewPluginSubscriptionCommandHandler.name);

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
	 * 7. Parent subscription renewal cascades to all active child subscriptions
	 * 8. Child subscription renewal does NOT affect parent or sibling subscriptions
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
			relations: ['plan', 'plugin', 'pluginTenant', 'children']
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

		// Cascade renewal to child subscriptions if this is a parent subscription
		const renewedChildren = await this.renewChildSubscriptions(subscription, newEndDate);

		if (renewedChildren.length > 0) {
			this.logger.log(`Renewed ${renewedChildren.length} child subscription(s) for parent subscription ${id}`);
		}

		// Add renewal metadata
		subscription.metadata = {
			...subscription.metadata,
			renewedChildCount: renewedChildren.length,
			renewedBy: subscriberId,
			renewalType: subscription.parentId ? 'child' : 'parent'
		};

		// Persist the renewed subscription
		const renewedSubscription = await this.pluginSubscriptionService.save(subscription);

		return renewedSubscription;
	}

	/**
	 * Renews all active child subscriptions when a parent subscription is renewed.
	 *
	 * @param subscription - The parent subscription being renewed
	 * @param newEndDate - The new end date to apply to children
	 * @returns Array of renewed child subscriptions
	 */
	private async renewChildSubscriptions(
		subscription: PluginSubscription,
		newEndDate: Date
	): Promise<PluginSubscription[]> {
		// Skip if this is a child subscription (no cascade needed)
		if (subscription.isInherited()) {
			return [];
		}

		// Find all active child subscriptions that can be renewed
		const activeChildren = await this.pluginSubscriptionService.find({
			where: {
				parentId: subscription.id,
				status: In([PluginSubscriptionStatus.ACTIVE, PluginSubscriptionStatus.EXPIRED])
			},
			relations: ['plan']
		});

		if (!activeChildren || activeChildren.length === 0) {
			return [];
		}

		const renewedChildren: PluginSubscription[] = [];

		for (const child of activeChildren) {
			if (child.canBeRenewed()) {
				try {
					child.renew(newEndDate);
					child.metadata = {
						...child.metadata,
						renewedByParent: true,
						parentSubscriptionId: subscription.id,
						renewedAt: new Date().toISOString()
					};
					renewedChildren.push(child);
				} catch (error) {
					this.logger.warn(`Failed to renew child subscription ${child.id}: ${error.message}`);
				}
			}
		}

		// Save all renewed children individually (service.save doesn't support arrays)
		if (renewedChildren.length > 0) {
			await Promise.all(renewedChildren.map((child) => this.pluginSubscriptionService.save(child)));
		}

		return renewedChildren;
	}
}
