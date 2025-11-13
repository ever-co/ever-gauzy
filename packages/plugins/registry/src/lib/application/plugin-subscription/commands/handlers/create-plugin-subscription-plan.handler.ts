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
		const { createDto, tenantId, organizationId } = command;

		try {
			return await this.pluginSubscriptionPlanService.createPlan(createDto, tenantId, organizationId);
		} catch (error) {
			throw new BadRequestException(`Failed to create plugin subscription plan: ${error.message}`);
		}
	}
}
