import { ID } from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionPlanService } from '../../../../domain';
import { IPluginSubscriptionPlan, IPluginSubscriptionPlanCreateInput } from '../../../../shared';
import { CreatePluginSubscriptionPlanCommand } from '../create-plugin-subscription-plan.command';

@CommandHandler(CreatePluginSubscriptionPlanCommand)
export class CreatePluginSubscriptionPlanCommandHandler
	implements ICommandHandler<CreatePluginSubscriptionPlanCommand>
{
	constructor(private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService) {}

	async execute(command: CreatePluginSubscriptionPlanCommand): Promise<IPluginSubscriptionPlan> {
		const { createDto, tenantId, organizationId, userId } = command;

		try {
			const { pluginId } = createDto;

			// Add required defaults and context
			const planData: Partial<IPluginSubscriptionPlanCreateInput> & { pluginId: ID; name: string } = {
				...createDto,
				pluginId,
				...(tenantId && { tenantId }),
				...(organizationId && { organizationId }),
				...(userId && { createdById: userId }),
				isActive: createDto.isActive ?? true
			};

			if (!planData.pluginId) {
				throw new BadRequestException('Plugin ID is required to create a subscription plan');
			}

			return this.pluginSubscriptionPlanService.createPlan(planData);
		} catch (error) {
			throw new BadRequestException(`Failed to create plugin subscription plan: ${error.message}`);
		}
	}
}
