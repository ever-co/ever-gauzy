import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskEstimation, ITaskEstimationUpdateInput } from '@gauzy/contracts';
import { CommandBus } from '@nestjs/cqrs';
import { TaskEstimationService } from '../../task-estimation.service';
import { TaskEstimationUpdateCommand } from '../task-estimation-update.command';
import { TaskEstimationCalculateCommand } from './../task-estimation-calculate.command';

@CommandHandler(TaskEstimationUpdateCommand)
export class TaskEstimationUpdateHandler
	implements ICommandHandler<TaskEstimationUpdateCommand>
{
	constructor(
		private readonly _taskEstimationService: TaskEstimationService,
		private readonly commandBus: CommandBus
	) {}

	public async execute(
		command: TaskEstimationUpdateCommand
	): Promise<ITaskEstimation> {
		const { id, input } = command;
		return await this.update(id, input);
	}

	/**
	 * Update task, if already exist
	 *
	 * @param id
	 * @param request
	 * @returns
	 */
	public async update(
		id: string,
		request: ITaskEstimationUpdateInput
	): Promise<ITaskEstimation> {
		try {
			const taskEstimation =
				await this._taskEstimationService.findOneByIdString(id);

			await this._taskEstimationService.update(id, {
				...request,
				id,
			});
			await this.commandBus.execute(
				new TaskEstimationCalculateCommand(taskEstimation.taskId)
			);
			return await this._taskEstimationService.create({
				...request,
				id,
			});
		} catch (error) {
			console.log('Error while updating task estimation', error?.message);
			throw new BadRequestException(error);
		}
	}
}
