import { ITask } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TaskCreateCommand } from './../task-create.command';
import { RequestContext } from './../../../core/context';
import { TaskService } from '../../task.service';

@CommandHandler(TaskCreateCommand)
export class TaskCreateHandler implements ICommandHandler<TaskCreateCommand> {
	constructor(
		private readonly _taskService: TaskService
	) {}

	public async execute(command: TaskCreateCommand): Promise<ITask> {
		try {
			const { input } = command;
			const { organizationId, project } = input;
			const tenantId = RequestContext.currentTenantId();

			const projectId = (project) ? project.id : null;
			const taskPrefix = (project) ? project.name.substring(0, 3) : null;
			
			const maxNumber = await this._taskService.getMaxTaskNumberByProject({
				tenantId,
				organizationId,
				projectId
			});
			return await this._taskService.create({
				...input,
				number: maxNumber + 1,
				prefix: taskPrefix
			});
		} catch (error) {
			console.log('Error while creating task', error);
		}
	}
}
