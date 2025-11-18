import { RequestContext } from '@gauzy/core';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { CancelPluginSubscriptionCommand } from '../cancel-plugin-subscription.command';

@CommandHandler(CancelPluginSubscriptionCommand)
export class CancelPluginSubscriptionCommandHandler implements ICommandHandler<CancelPluginSubscriptionCommand> {
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
	 * 6. Cancellation may trigger prorated refund calculations (handled elsewhere)
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
		const currentUser = RequestContext.currentUser();

		// Find the existing subscription with proper tenant/organization filtering
		const subscription = await this.pluginSubscriptionService.findOneByIdString(id, {
			where: {
				tenantId,
				...(organizationId && { organizationId }),
				...(currentUser.employeeId && { subscriberId: currentUser.employeeId })
			},
			relations: ['plan', 'plugin', 'pluginTenant']
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

		// Persist the cancelled subscription
		const cancelledSubscription = await this.pluginSubscriptionService.save(subscription);

		return cancelledSubscription;
	}
}
