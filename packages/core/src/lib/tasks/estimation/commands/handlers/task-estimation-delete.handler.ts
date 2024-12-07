import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CommandBus } from '@nestjs/cqrs';
import { TaskEstimationCalculateCommand } from '..';
import { TaskEstimationService } from '../../task-estimation.service';
import { TaskEstimationDeleteCommand } from '../task-estimation-delete.command';

@CommandHandler(TaskEstimationDeleteCommand)
export class TaskEstimationDeleteHandler
	implements ICommandHandler<TaskEstimationDeleteCommand>
{
	constructor(
		private readonly _taskEstimationService: TaskEstimationService,
		private readonly commandBus: CommandBus
	) {}

	public async execute(command: TaskEstimationDeleteCommand) {
		const { id } = command;
		return await this.delete(id);
	}

	/**
	 * Delete task estimation, if already exist
	 *
	 * @param id
	 * @returns
	 */
	public async delete(id: string) {
		try {
			const taskEstimation =
				await this._taskEstimationService.findOneByIdString(id);
			const deleteResponse = await this._taskEstimationService.delete(id);
			await this.commandBus.execute(
				new TaskEstimationCalculateCommand(taskEstimation.taskId)
			);
			return deleteResponse;
		} catch (error) {
			console.log('Error while deleting task estimation', error?.message);
			throw new BadRequestException(error);
		}
	}
}
