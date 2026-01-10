import { RequestContext } from '@gauzy/core';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { ExtendTrialSubscriptionCommand } from '../extend-trial-subscription.command';

@CommandHandler(ExtendTrialSubscriptionCommand)
export class ExtendTrialSubscriptionCommandHandler implements ICommandHandler<ExtendTrialSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	/**
	 * Execute trial subscription extension command.
	 *
	 * Business Rules:
	 * 1. Subscription must exist and be accessible by the requesting user
	 * 2. Subscription must be in TRIAL status with an active trial period
	 * 3. Extension adds the specified number of days to the current trial end date
	 * 4. Updates subscription metadata to track extension details
	 * 5. Sets updatedAt timestamp to current time
	 *
	 * @param command - The extend trial command with subscription ID and extension days
	 * @returns The updated subscription with extended trial period
	 * @throws NotFoundException if subscription doesn't exist or access is denied
	 * @throws BadRequestException if trial extension conditions are not met
	 */
	async execute(command: ExtendTrialSubscriptionCommand): Promise<IPluginSubscription> {
		const { subscriptionId, days, tenantId, organizationId, userId } = command;

		// Get current context for security filtering
		const currentTenantId = RequestContext.currentTenantId();
		const currentOrganizationId = RequestContext.currentOrganizationId();
		const currentUser = RequestContext.currentUser();

		// Use command parameters or fall back to current context
		const effectiveTenantId = tenantId || currentTenantId;
		const effectiveOrganizationId = organizationId || currentOrganizationId;
		const effectiveUserId = userId || currentUser?.id;

		// Find the subscription with proper tenant/organization filtering
		const subscription = await this.pluginSubscriptionService.findOneByIdString(subscriptionId, {
			where: {
				tenantId: effectiveTenantId,
				...(effectiveOrganizationId && { organizationId: effectiveOrganizationId }),
				...(effectiveUserId && { subscriberId: effectiveUserId })
			},
			relations: ['plan', 'plugin', 'pluginTenant']
		});

		if (!subscription) {
			throw new NotFoundException(`Plugin subscription with ID ${subscriptionId} not found or access denied`);
		}

		// Validate that the trial can be extended using domain method
		if (!subscription.canExtendTrial()) {
			throw new BadRequestException(
				'Cannot extend trial: subscription is not in trial status or trial has already expired'
			);
		}

		// Validate extension days
		if (!days || days <= 0) {
			throw new BadRequestException('Extension days must be a positive number');
		}

		// Use domain method to extend trial (includes validation and business logic)
		const extendedSubscription = subscription.extendTrial(days, effectiveUserId);

		// Cascade trial extension to child subscriptions if this is a parent subscription
		extendedSubscription.children = extendedSubscription.children.map((child) =>
			child.extendTrial(days, effectiveUserId)
		);

		// Update metadata with extension details
		extendedSubscription.metadata = {
			...extendedSubscription.metadata,
			trialExtendedBy: effectiveUserId,
			trialExtensionDays: days,
			trialExtendedAt: new Date()
		};

		// Persist the updated subscription
		return this.pluginSubscriptionService.save(extendedSubscription);
	}
}
