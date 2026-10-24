import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginService, PluginSubscriptionPlanService } from '../../../../domain';
import { DeletePluginSubscriptionPlanCommand } from '../delete-plugin-subscription-plan.command';
import { assertOwnsPlans } from './plan-ownership';

@CommandHandler(DeletePluginSubscriptionPlanCommand)
export class DeletePluginSubscriptionPlanCommandHandler
	implements ICommandHandler<DeletePluginSubscriptionPlanCommand>
{
	constructor(
		private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService,
		private readonly pluginService: PluginService
	) {}

	async execute(command: DeletePluginSubscriptionPlanCommand): Promise<void> {
		const { id } = command;

		// Only the owner of the plan's plugin may delete it
		await assertOwnsPlans(this.pluginService, this.pluginSubscriptionPlanService, [id]);

		try {
			await this.pluginSubscriptionPlanService.deletePlan(id);
		} catch (error) {
			throw new BadRequestException(`Failed to delete plugin subscription plan: ${error.message}`);
		}
	}
}
