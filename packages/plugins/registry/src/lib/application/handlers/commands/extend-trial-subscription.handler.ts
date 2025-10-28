import { IPluginSubscription } from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../domain/services/plugin-subscription.service';
import { ExtendTrialSubscriptionCommand } from '../../commands/extend-trial-subscription.command';

@CommandHandler(ExtendTrialSubscriptionCommand)
export class ExtendTrialSubscriptionCommandHandler implements ICommandHandler<ExtendTrialSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(command: ExtendTrialSubscriptionCommand): Promise<IPluginSubscription> {
		const { subscriptionId, days, tenantId, organizationId, userId } = command;

		try {
			const result = await this.pluginSubscriptionService.extendTrial(
				subscriptionId,
				days,
				tenantId,
				organizationId,
				userId
			);
			return result as IPluginSubscription;
		} catch (error) {
			throw new BadRequestException(`Failed to extend trial subscription: ${error.message}`);
		}
	}
}
