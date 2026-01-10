import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionPlanService } from '../../../../domain';
import { BulkPluginPlanOperationCommand } from '../bulk-plugin-plan-operation.command';

@CommandHandler(BulkPluginPlanOperationCommand)
export class BulkPluginPlanOperationCommandHandler implements ICommandHandler<BulkPluginPlanOperationCommand> {
	constructor(private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService) {}

	async execute(command: BulkPluginPlanOperationCommand): Promise<void> {
		const { operationDto } = command;

		try {
			await this.pluginSubscriptionPlanService.bulkOperation(operationDto.planIds, operationDto.operation);
		} catch (error) {
			throw new BadRequestException(`Failed to perform bulk operation on plugin plans: ${error.message}`);
		}
	}
}
