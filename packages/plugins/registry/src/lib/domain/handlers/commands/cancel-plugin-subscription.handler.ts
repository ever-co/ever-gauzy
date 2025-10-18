import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { CancelPluginSubscriptionCommand } from '../../commands';
import { PluginSubscriptionService } from '../../services';
import { PluginSubscription } from '../../entities';
import { IPluginSubscription } from '../../../shared/models';

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
