import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { CreatePluginSubscriptionCommand } from '../create-plugin-subscription.command';

@CommandHandler(CreatePluginSubscriptionCommand)
export class CreatePluginSubscriptionCommandHandler implements ICommandHandler<CreatePluginSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(command: CreatePluginSubscriptionCommand): Promise<IPluginSubscription> {
		const { createDto } = command;

		try {
			return await this.pluginSubscriptionService.create(createDto);
		} catch (error) {
			throw new BadRequestException(`Failed to create plugin subscription: ${error.message}`);
		}
	}
}
