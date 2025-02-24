import { HttpException, HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IScreeningTask } from '@gauzy/contracts';
import { ScreeningTasksService } from '../../screening-tasks.service';
import { ScreeningTaskCreateCommand } from '../screening-task.create.command';

@CommandHandler(ScreeningTaskCreateCommand)
export class ScreeningTaskCreateHandler implements ICommandHandler<ScreeningTaskCreateCommand> {
	constructor(private readonly screeningTasksService: ScreeningTasksService) {}

	/**
	 * Executes the create command for a screening task.
	 *
	 * @param command - The command containing the creation input for a screening task.
	 * @returns A promise that resolves to the newly created screening task.
	 */
	public async execute(command: ScreeningTaskCreateCommand): Promise<IScreeningTask> {
		try {
			const { input } = command;
			return await this.screeningTasksService.create(input);
		} catch (error) {
			throw new HttpException('Screening task creation failed', HttpStatus.BAD_REQUEST);
		}
	}
}
