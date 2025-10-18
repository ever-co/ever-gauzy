import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { RenewPluginSubscriptionCommand } from '../../commands';
import { PluginSubscriptionService } from '../../services';
import { IPluginSubscription } from '../../../shared/models';

@CommandHandler(RenewPluginSubscriptionCommand)
export class RenewPluginSubscriptionCommandHandler implements ICommandHandler<RenewPluginSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(command: RenewPluginSubscriptionCommand): Promise<IPluginSubscription> {
		const { id } = command;

		try {
			return await this.pluginSubscriptionService.renewSubscription(id);
		} catch (error) {
			throw new BadRequestException(`Failed to renew plugin subscription: ${error.message}`);
		}
	}
}
