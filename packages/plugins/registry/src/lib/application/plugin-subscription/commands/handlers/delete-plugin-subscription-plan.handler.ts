import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionPlanService } from '../../../../domain';
import { DeletePluginSubscriptionPlanCommand } from '../delete-plugin-subscription-plan.command';

@CommandHandler(DeletePluginSubscriptionPlanCommand)
export class DeletePluginSubscriptionPlanCommandHandler
	implements ICommandHandler<DeletePluginSubscriptionPlanCommand>
{
	constructor(private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService) {}

	async execute(command: DeletePluginSubscriptionPlanCommand): Promise<void> {
		const { id } = command;

		try {
			await this.pluginSubscriptionPlanService.deletePlan(id);
		} catch (error) {
			throw new BadRequestException(`Failed to delete plugin subscription plan: ${error.message}`);
		}
	}
}
