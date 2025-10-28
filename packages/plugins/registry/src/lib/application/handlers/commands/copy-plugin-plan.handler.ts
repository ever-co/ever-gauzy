import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionPlanService } from '../../../domain/services/plugin-subscription-plan.service';
import { IPluginSubscriptionPlan } from '../../../shared/models/plugin-subscription.model';
import { CopyPluginPlanCommand } from '../../commands/copy-plugin-plan.command';

@CommandHandler(CopyPluginPlanCommand)
export class CopyPluginPlanCommandHandler implements ICommandHandler<CopyPluginPlanCommand> {
	constructor(private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService) {}

	async execute(command: CopyPluginPlanCommand): Promise<IPluginSubscriptionPlan> {
		const { copyDto, tenantId, organizationId } = command;

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
