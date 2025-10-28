import { IPluginSubscription } from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../domain/services/plugin-subscription.service';
import { DowngradePluginSubscriptionCommand } from '../../commands/downgrade-plugin-subscription.command';

@CommandHandler(DowngradePluginSubscriptionCommand)
export class DowngradePluginSubscriptionCommandHandler implements ICommandHandler<DowngradePluginSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(command: DowngradePluginSubscriptionCommand): Promise<IPluginSubscription> {
		const { subscriptionId, newPlanId, tenantId, organizationId, userId } = command;

		try {
			const result = await this.pluginSubscriptionService.downgradeSubscription(
				subscriptionId,
				newPlanId,
				tenantId,
				organizationId,
				userId
			);
			return result as IPluginSubscription;
		} catch (error) {
			throw new BadRequestException(`Failed to downgrade plugin subscription: ${error.message}`);
		}
	}
}
