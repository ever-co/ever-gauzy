import { ITask, ITaskUpdateInput } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestContext } from './../../../core/context';
import { TaskService } from '../../task.service';
import { TaskUpdateCommand } from '../task-update.command';
import { BadRequestException } from '@nestjs/common';

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
			const tenantId = RequestContext.currentTenantId();
			const { organizationId, project } = request;
			const projectId = (project) ? project.id : null;

			const maxNumber = await this._taskService.getMaxTaskNumberByProject({
				tenantId,
				organizationId,
				projectId
			});
			return await this._taskService.create({
				...request,
				number: maxNumber + 1,
				id
			});
		} catch (error) {
			console.log('Error while updating task', error?.message);
			throw new BadRequestException(error);
		}
	}
}
