import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { UpdatePluginSubscriptionCommand } from '../update-plugin-subscription.command';

@CommandHandler(UpdatePluginSubscriptionCommand)
export class UpdatePluginSubscriptionCommandHandler implements ICommandHandler<UpdatePluginSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(command: UpdatePluginSubscriptionCommand): Promise<IPluginSubscription | UpdateResult> {
		const { id, updateDto } = command;

		try {
			return this.pluginSubscriptionService.update(id, updateDto);
		} catch (error) {
			throw new BadRequestException(`Failed to update plugin subscription: ${error.message}`);
		}
	}
}
