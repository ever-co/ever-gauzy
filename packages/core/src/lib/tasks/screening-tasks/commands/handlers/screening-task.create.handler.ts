import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IScreeningTask } from '@gauzy/contracts';
import { ScreeningTasksService } from '../../screening-tasks.service';
import { ScreeningTaskCreateCommand } from '../screening-task.create.command';

@CommandHandler(ScreeningTaskCreateCommand)
export class ScreeningTaskCreateHandler implements ICommandHandler<ScreeningTaskCreateCommand> {
	constructor(private readonly screeningTasksService: ScreeningTasksService) {}

	public async execute(command: ScreeningTaskCreateCommand): Promise<IScreeningTask> {
		const { input } = command;
		return await this.screeningTasksService.create(input);
	}
}
