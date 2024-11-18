import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { TaskEstimationCalculateCommand } from '../task-estimation-calculate.command';
import { TaskEstimationService } from '../../task-estimation.service';
import { TaskService } from '../../../task.service';

@CommandHandler(TaskEstimationCalculateCommand)
export class TaskEstimationCalculateHandler implements ICommandHandler<TaskEstimationCalculateCommand> {
	constructor(
		private readonly _taskEstimationService: TaskEstimationService,
		private readonly _taskService: TaskService
	) {}

	public async execute(command: TaskEstimationCalculateCommand) {
		try {
			const { id: taskId } = command;

			const taskEstimations = await this._taskEstimationService.findAll({
				where: {
					taskId
				}
			});
			const totalEstimation = taskEstimations.items.reduce((sum, current) => sum + current.estimate, 0);
			const averageEstimation = Math.ceil(totalEstimation / taskEstimations.items.length);
			await this._taskService.update(taskId, {
				estimate: averageEstimation
			});
		} catch (error) {
			console.log('Error while creating task estimation', error?.message);
			throw new BadRequestException(error);
		}
	}
}
