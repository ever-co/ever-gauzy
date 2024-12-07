import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskView } from '@gauzy/contracts';
import { TaskViewService } from '../../view.service';
import { TaskViewCreateCommand } from '../task-view-create.command';

@CommandHandler(TaskViewCreateCommand)
export class TaskViewCreateHandler implements ICommandHandler<TaskViewCreateCommand> {
	constructor(private readonly taskViewService: TaskViewService) {}

	public async execute(command: TaskViewCreateCommand): Promise<ITaskView> {
		const { input } = command;
		return await this.taskViewService.create(input);
	}
}
