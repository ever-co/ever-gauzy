import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { DowngradePluginSubscriptionCommand } from '../downgrade-plugin-subscription.command';

@CommandHandler(DowngradePluginSubscriptionCommand)
export class DowngradePluginSubscriptionCommandHandler implements ICommandHandler<DowngradePluginSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(command: DowngradePluginSubscriptionCommand): Promise<IPluginSubscription> {
		const { subscriptionId, newPlanId, tenantId, organizationId, userId } = command;

		try {
			return this.pluginSubscriptionService.downgradeSubscription(
				subscriptionId,
				newPlanId,
				tenantId,
				organizationId,
				userId
			);
		} catch (error) {
			throw new BadRequestException(`Failed to downgrade plugin subscription: ${error.message}`);
		}
	}
}
