import { ITaskEstimation } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { TaskEstimationCreateCommand } from './../task-estimation-create.command';
import { TaskEstimationService } from '../../task-estimation.service';
import { TaskEstimationCalculateCommand } from './../task-estimation-calculate.command';
import { TaskEstimation } from '../../task-estimation.entity';

@CommandHandler(TaskEstimationCreateCommand)
export class TaskEstimationCreateHandler
	implements ICommandHandler<TaskEstimationCreateCommand>
{
	constructor(
		private readonly _taskEstimationService: TaskEstimationService,
		private readonly commandBus: CommandBus
	) {}

	public async execute(
		command: TaskEstimationCreateCommand
	): Promise<ITaskEstimation> {
		const { input } = command;
		let taskEstimationAlreadyPresent: TaskEstimation;

		try {
			taskEstimationAlreadyPresent =
				await this._taskEstimationService.findOneByWhereOptions({
					tenantId: input.tenantId,
					organizationId: input.organizationId,
					taskId: input.taskId,
					employeeId: input.employeeId,
				});
		} catch (error) {
			console.log('Error while fetching task estimation', error?.message);
		}
		if (taskEstimationAlreadyPresent) {
			throw new BadRequestException(
				'Record for this member is already present'
			);
		}

		try {
			const taskEstimation = await this._taskEstimationService.create(
				input
			);
			await this.commandBus.execute(
				new TaskEstimationCalculateCommand(input.taskId)
			);
			return taskEstimation;
		} catch (error) {
			console.log('Error while creating task estimation', error?.message);
			throw new BadRequestException(error);
		}
	}
}
