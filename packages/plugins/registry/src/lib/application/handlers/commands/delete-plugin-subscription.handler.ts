import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../domain/services';
import { DeletePluginSubscriptionCommand } from '../../commands';

@CommandHandler(DeletePluginSubscriptionCommand)
export class DeletePluginSubscriptionCommandHandler implements ICommandHandler<DeletePluginSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(command: DeletePluginSubscriptionCommand): Promise<void> {
		const { id } = command;

		try {
			await this.pluginSubscriptionService.delete(id);
		} catch (error) {
			throw new BadRequestException(`Failed to delete plugin subscription: ${error.message}`);
		}
	}
}
