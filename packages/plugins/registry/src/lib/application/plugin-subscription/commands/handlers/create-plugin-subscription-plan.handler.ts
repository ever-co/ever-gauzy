import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionPlanService } from '../../../../domain';
import { IPluginSubscriptionPlan } from '../../../../shared';
import { CreatePluginSubscriptionPlanCommand } from '../create-plugin-subscription-plan.command';

@CommandHandler(CreatePluginSubscriptionPlanCommand)
export class CreatePluginSubscriptionPlanCommandHandler
	implements ICommandHandler<CreatePluginSubscriptionPlanCommand>
{
	constructor(private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService) {}

	async execute(command: CreatePluginSubscriptionPlanCommand): Promise<IPluginSubscriptionPlan> {
		const { createDto, userId } = command;

		try {
			// Add required defaults and context
			const planData = {
				...createDto,
				...(userId && { createdById: userId }),
				isActive: createDto.isActive ?? true
			};

			return this.pluginSubscriptionPlanService.createPlan(planData);
		} catch (error) {
			throw new BadRequestException(`Failed to create plugin subscription plan: ${error.message}`);
		}
	}
}
