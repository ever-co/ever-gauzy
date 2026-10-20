import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginService, PluginSubscriptionPlanService } from '../../../../domain';
import { IPluginSubscriptionPlan } from '../../../../shared';
import { CopyPluginPlanCommand } from '../copy-plugin-plan.command';
import { assertOwnsPlans } from './plan-ownership';

@CommandHandler(CopyPluginPlanCommand)
export class CopyPluginPlanCommandHandler implements ICommandHandler<CopyPluginPlanCommand> {
	constructor(
		private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService,
		private readonly pluginService: PluginService
	) {}

	async execute(command: CopyPluginPlanCommand): Promise<IPluginSubscriptionPlan> {
		const { copyDto, tenantId, organizationId } = command;

		// Only the owner of the source plan's plugin may copy it (the copy belongs to the same plugin)
		await assertOwnsPlans(this.pluginService, this.pluginSubscriptionPlanService, [copyDto.sourcePlanId]);

		try {
			return await this.pluginSubscriptionPlanService.copyPlan(
				copyDto.sourcePlanId,
				copyDto.newName,
				copyDto.newDescription,
				copyDto.newPrice,
				tenantId,
				organizationId
			);
		} catch (error) {
			throw new BadRequestException(`Failed to copy plugin subscription plan: ${error.message}`);
		}
	}
}
