import { ICommandHandler } from '@nestjs/cqrs';
import { ITaskView } from '@gauzy/contracts';
import { TaskViewUpdateCommand } from '../task-view-update.command';
import { TaskViewService } from '../../view.service';

export class TaskViewUpdateHandler implements ICommandHandler<TaskViewUpdateCommand> {
	constructor(private readonly taskViewService: TaskViewService) {}

	public async execute(command: TaskViewUpdateCommand): Promise<ITaskView> {
		const { id, input } = command;

		return await this.taskViewService.create({
			...input,
			id
		});
	}
}
