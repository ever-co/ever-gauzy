import { IPluginSubscription } from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../domain/services/plugin-subscription.service';
import { UpgradePluginSubscriptionCommand } from '../../commands/upgrade-plugin-subscription.command';

@CommandHandler(UpgradePluginSubscriptionCommand)
export class UpgradePluginSubscriptionCommandHandler implements ICommandHandler<UpgradePluginSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(command: UpgradePluginSubscriptionCommand): Promise<IPluginSubscription> {
		const { subscriptionId, newPlanId, tenantId, organizationId, userId } = command;

		try {
			const result = await this.pluginSubscriptionService.upgradeSubscription(
				subscriptionId,
				newPlanId,
				tenantId,
				organizationId,
				userId
			);
			return result as IPluginSubscription;
		} catch (error) {
			throw new BadRequestException(`Failed to upgrade plugin subscription: ${error.message}`);
		}
	}
}
