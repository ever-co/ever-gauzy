import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionPlanService } from '../../../domain/services/plugin-subscription-plan.service';
import { IPluginSubscriptionPlan } from '../../../shared/models/plugin-subscription.model';
import { UpdatePluginSubscriptionPlanCommand } from '../../commands/update-plugin-subscription-plan.command';

@CommandHandler(UpdatePluginSubscriptionPlanCommand)
export class UpdatePluginSubscriptionPlanCommandHandler
	implements ICommandHandler<UpdatePluginSubscriptionPlanCommand>
{
	constructor(private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService) {}

	async execute(command: UpdatePluginSubscriptionPlanCommand): Promise<IPluginSubscriptionPlan> {
		const { id, updateDto } = command;

		try {
			return await this.pluginSubscriptionPlanService.updatePlan(id, updateDto);
		} catch (error) {
			throw new BadRequestException(`Failed to update plugin subscription plan: ${error.message}`);
		}
	}
}
