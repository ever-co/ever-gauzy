import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';
import { PluginService, PluginSubscriptionPlanService } from '../../../../domain';
import { IPluginSubscriptionPlan } from '../../../../shared';
import { UpdatePluginSubscriptionPlanCommand } from '../update-plugin-subscription-plan.command';
import { assertOwnsPlans, assertOwnsPlugin } from './plan-ownership';

@CommandHandler(UpdatePluginSubscriptionPlanCommand)
export class UpdatePluginSubscriptionPlanCommandHandler
	implements ICommandHandler<UpdatePluginSubscriptionPlanCommand>
{
	constructor(
		private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService,
		private readonly pluginService: PluginService
	) {}

	async execute(command: UpdatePluginSubscriptionPlanCommand): Promise<IPluginSubscriptionPlan> {
		const { id, updateDto } = command;

		// Only the owner of the plan's plugin may change it, and only move it to another plugin they own
		await assertOwnsPlans(this.pluginService, this.pluginSubscriptionPlanService, [id]);
		// The update DTO names no plugin today; a body that carries one anyway (another client, a later DTO) is checked
		const movedTo = (updateDto as { pluginId?: ID } | undefined)?.pluginId;
		if (movedTo) {
			await assertOwnsPlugin(this.pluginService, movedTo);
		}

		try {
			return await this.pluginSubscriptionPlanService.updatePlan(id, updateDto);
		} catch (error) {
			throw new BadRequestException(`Failed to update plugin subscription plan: ${error.message}`);
		}
	}
}
