import { ITask, ITaskUpdateInput } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TaskService } from '../../task.service';
import { TaskUpdateCommand } from '../task-update.command';

@CommandHandler(TaskUpdateCommand)
export class TaskUpdateHandler implements ICommandHandler<TaskUpdateCommand> {
	constructor(
		private readonly _taskService: TaskService
	) {}

	public async execute(command: TaskUpdateCommand): Promise<ITask> {
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
		request: ITaskUpdateInput
	): Promise<ITask> {
		try {
			return await this._taskService.create({
				...request,
				id
			});
		} catch (error) {
			console.log('Error while updating task', error);
		}
	}
}
