import { ID } from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginService, PluginSubscriptionPlanService } from '../../../../domain';
import { IPluginSubscriptionPlan, IPluginSubscriptionPlanCreateInput } from '../../../../shared';
import { CreatePluginSubscriptionPlanCommand } from '../create-plugin-subscription-plan.command';
import { assertOwnsPlugin } from './plan-ownership';

@CommandHandler(CreatePluginSubscriptionPlanCommand)
export class CreatePluginSubscriptionPlanCommandHandler
	implements ICommandHandler<CreatePluginSubscriptionPlanCommand>
{
	constructor(
		private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService,
		private readonly pluginService: PluginService
	) {}

	async execute(command: CreatePluginSubscriptionPlanCommand): Promise<IPluginSubscriptionPlan> {
		const { createDto, tenantId, organizationId, userId } = command;

		// Only the plugin's owner may add a plan to it (outside the try: a refusal is not a failed create)
		await assertOwnsPlugin(this.pluginService, createDto.pluginId);

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
