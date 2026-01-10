import { BadRequestException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { IPluginSubscriptionPlan } from '../../../../shared';
import { SubscriptionPlanOperationFactory } from '../../../strategies';
import { BulkCreatePluginPlansCommand } from '../bulk-create-plugin-plans.command';

@CommandHandler(BulkCreatePluginPlansCommand)
export class BulkCreatePluginPlansHandler implements ICommandHandler<BulkCreatePluginPlansCommand> {
	constructor(private readonly commandBus: CommandBus, private readonly dataSource: DataSource) {}

	/**
	 * Executes the bulk create plugin plans command
	 *
	 * @param command - The command containing multiple plans creation data
	 * @returns Array of created plugin subscription plans
	 * @throws BadRequestException if validation fails
	 */
	async execute(command: BulkCreatePluginPlansCommand): Promise<IPluginSubscriptionPlan[]> {
		const { plans, tenantId, organizationId, userId } = command;

		if (!plans || plans.length === 0) {
			throw new BadRequestException('At least one plan must be provided');
		}

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// Create all plans within a transaction
			// Use strategy pattern to handle create/update operations
			const context = {
				pluginId: null,
				tenantId,
				organizationId,
				userId,
				commandBus: this.commandBus
			};
			const createdPlans = await Promise.all(
				plans.map((planData) => SubscriptionPlanOperationFactory.execute(planData, context))
			);

			await queryRunner.commitTransaction();
			// Return the created plans
			return createdPlans;
		} catch (error) {
			// Rollback transaction on error
			await queryRunner.rollbackTransaction();
			throw new BadRequestException(`Failed to create plugin plans: ${error.message}`);
		} finally {
			// Release queryRunner resources
			await queryRunner.release();
		}
	}
}
