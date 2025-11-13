import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { CancelPluginSubscriptionCommand } from '../cancel-plugin-subscription.command';

@CommandHandler(CancelPluginSubscriptionCommand)
export class CancelPluginSubscriptionCommandHandler implements ICommandHandler<CancelPluginSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(command: CancelPluginSubscriptionCommand): Promise<IPluginSubscription> {
		const { id, reason } = command;

		try {
			return this.pluginSubscriptionService.cancelSubscription(id, reason);
		} catch (error) {
			throw new BadRequestException(`Failed to cancel plugin subscription: ${error.message}`);
		}
	}
}
