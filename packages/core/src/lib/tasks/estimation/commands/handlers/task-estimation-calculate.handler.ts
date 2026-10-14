import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { TaskEstimationCalculateCommand } from '../task-estimation-calculate.command';
import { TaskEstimationService } from '../../task-estimation.service';
import { TaskService } from '../../../task.service';

/**
 * The task estimate: the average of the estimations, rounded up, or `null` once there is none left.
 *
 * Deleting the last estimation used to compute `0 / 0`, and the NaN was rejected by the database.
 */
export function averageEstimate(estimates: number[]): number | null {
	if (!estimates.length) {
		return null;
	}
	const total = estimates.reduce((sum, estimate) => sum + Number(estimate), 0);
	return Math.ceil(total / estimates.length);
}

@CommandHandler(TaskEstimationCalculateCommand)
export class TaskEstimationCalculateHandler implements ICommandHandler<TaskEstimationCalculateCommand> {
	constructor(
		private readonly _taskEstimationService: TaskEstimationService,
		private readonly _taskService: TaskService
	) {}

	public async execute(command: TaskEstimationCalculateCommand) {
		try {
			const { id: taskId } = command;

			// Everybody's estimations, not only the caller's (see `findAllForTask`)
			const estimations = await this._taskEstimationService.findAllForTask(taskId);
			await this._taskService.update(taskId, {
				estimate: averageEstimate(estimations.map(({ estimate }) => estimate))
			});
		} catch (error) {
			console.log('Error while creating task estimation', error?.message);
			throw new BadRequestException(error);
		}
	}
}
