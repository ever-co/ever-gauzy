import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginService, PluginSubscriptionPlanService } from '../../../../domain';
import { BulkPluginPlanOperationCommand } from '../bulk-plugin-plan-operation.command';
import { assertOwnsPlans } from './plan-ownership';

@CommandHandler(BulkPluginPlanOperationCommand)
export class BulkPluginPlanOperationCommandHandler implements ICommandHandler<BulkPluginPlanOperationCommand> {
	constructor(
		private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService,
		private readonly pluginService: PluginService
	) {}

	async execute(command: BulkPluginPlanOperationCommand): Promise<void> {
		const { operationDto } = command;

		// Every plan must belong to a plugin the caller owns: one foreign id refuses the whole operation
		await assertOwnsPlans(this.pluginService, this.pluginSubscriptionPlanService, operationDto.planIds ?? []);

		try {
			await this.pluginSubscriptionPlanService.bulkOperation(operationDto.planIds, operationDto.operation);
		} catch (error) {
			throw new BadRequestException(`Failed to perform bulk operation on plugin plans: ${error.message}`);
		}
	}
}
