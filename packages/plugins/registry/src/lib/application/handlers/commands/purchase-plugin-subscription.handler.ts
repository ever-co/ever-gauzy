import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../domain/services';
import { IPluginSubscription } from '../../../shared/models';
import { PurchasePluginSubscriptionCommand } from '../../commands';

@CommandHandler(PurchasePluginSubscriptionCommand)
export class PurchasePluginSubscriptionCommandHandler implements ICommandHandler<PurchasePluginSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	/**
	 * Execute plugin subscription purchase with proper handling for free vs paid plans.
	 *
	 * Business Rules:
	 * 1. Free Plans: Automatically create USER-scoped subscriptions with immediate ACTIVE status
	 * 2. Paid Plans: Create subscriptions at the requested scope (TENANT/ORGANIZATION/USER) with PENDING status until payment
	 * 3. Trial Plans: Create subscriptions with TRIAL status and set trial end date
	 *
	 * @param command - The purchase command with subscription details
	 * @returns The created subscription
	 */
	async execute(command: PurchasePluginSubscriptionCommand): Promise<IPluginSubscription> {
		const { purchaseDto, tenantId, organizationId, userId } = command;

		try {
			// Purchase the subscription with automatic scope determination and status handling
			const subscription = await this.pluginSubscriptionService.purchaseSubscription(
				purchaseDto,
				tenantId,
				organizationId,
				userId
			);

			return subscription;
		} catch (error) {
			throw new BadRequestException(`Failed to purchase plugin subscription: ${error.message}`);
		}
	}
}
