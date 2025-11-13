import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { ExtendTrialSubscriptionCommand } from '../extend-trial-subscription.command';

@CommandHandler(ExtendTrialSubscriptionCommand)
export class ExtendTrialSubscriptionCommandHandler implements ICommandHandler<ExtendTrialSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(command: ExtendTrialSubscriptionCommand): Promise<IPluginSubscription> {
		const { subscriptionId, days, tenantId, organizationId, userId } = command;

		try {
			return this.pluginSubscriptionService.extendTrial(subscriptionId, days, tenantId, organizationId, userId);
		} catch (error) {
			throw new BadRequestException(`Failed to extend trial subscription: ${error.message}`);
		}
	}
}
