import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ScreeningTasksService } from '../../screening-tasks.service';
import { ScreeningTaskUpdateCommand } from '../screening-task.update.command';
import { IScreeningTask } from '@gauzy/contracts';

@CommandHandler(ScreeningTaskUpdateCommand)
export class ScreeningTaskUpdateHandler implements ICommandHandler<ScreeningTaskUpdateCommand> {
	constructor(private readonly screeningTasksService: ScreeningTasksService) {}

	public async execute(command: ScreeningTaskUpdateCommand): Promise<IScreeningTask> {
		const { id, input } = command;
		return await this.screeningTasksService.update(id, input);
	}
}
