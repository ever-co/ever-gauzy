import { Task } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TaskCreateCommand } from '..';
import { TaskService } from '../../task.service';

@CommandHandler(TaskCreateCommand)
export class TaskCreateHandler implements ICommandHandler<TaskCreateCommand> {
	constructor(private readonly taskService: TaskService) {}

	public async execute(command: TaskCreateCommand): Promise<Task> {
		const { input } = command;

		return await this.taskService.create(input);
	}
}
