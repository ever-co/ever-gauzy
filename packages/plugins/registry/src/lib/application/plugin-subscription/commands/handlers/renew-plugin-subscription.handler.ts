import { RequestContext } from '@gauzy/core';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
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
		try {
			// Find the existing subscription with proper tenant/organization filtering
			const subscription = await this.pluginSubscriptionService.findOneByIdString(id, {
				where: {
					tenantId,
					...(organizationId && { organizationId }),
					...(subscriberId && { subscriberId })
				},
				relations: ['plan', 'plugin', 'pluginTenant', 'children', 'parent']
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

			const renewedSubscription = subscription.renew(newEndDate);

			// Cascade renewal to child subscriptions if this is a parent subscription
			const renewedChildren = this.renewChildSubscriptions(renewedSubscription, newEndDate);

			if (renewedChildren.length > 0) {
				this.logger.log(
					`Renewed ${renewedChildren.length} child subscription(s) for parent subscription ${id}`
				);
			}

			// Add renewal metadata
			renewedSubscription.metadata = {
				...renewedSubscription.metadata,
				renewedChildCount: renewedChildren.length,
				renewedBy: subscriberId,
				renewalType: renewedSubscription.isInherited() ? 'child' : 'parent'
			};

			// Persist the renewed subscription
			return this.pluginSubscriptionService.save(renewedSubscription);
		} catch (error) {
			throw new BadRequestException(`Failed to renew subscription: ${error.message}`);
		}
	}

	/**
	 * Renews all active child subscriptions when a parent subscription is renewed.
	 *
	 * @param subscription - The parent subscription being renewed
	 * @param newEndDate - The new end date to apply to children
	 * @returns Array of renewed child subscriptions
	 */
	private renewChildSubscriptions(subscription: PluginSubscription, newEndDate: Date): IPluginSubscription[] {
		// Skip if this is a child subscription (no cascade needed)
		if (subscription.isInherited()) return [];

		return subscription.children.map((child) => child.renew(newEndDate));
	}
}
