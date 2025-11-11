import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../domain/services/plugin-subscription.service';
import { IPluginSubscription } from '../../../shared/models';
import { UpgradePluginSubscriptionCommand } from '../../commands/upgrade-plugin-subscription.command';

@CommandHandler(UpgradePluginSubscriptionCommand)
export class UpgradePluginSubscriptionCommandHandler implements ICommandHandler<UpgradePluginSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(command: UpgradePluginSubscriptionCommand): Promise<IPluginSubscription> {
		const { subscriptionId, newPlanId, tenantId, organizationId, userId } = command;

		try {
			return this.pluginSubscriptionService.upgradeSubscription(
				subscriptionId,
				newPlanId,
				tenantId,
				organizationId,
				userId
			);
		} catch (error) {
			throw new BadRequestException(`Failed to upgrade plugin subscription: ${error.message}`);
		}
	}
}
