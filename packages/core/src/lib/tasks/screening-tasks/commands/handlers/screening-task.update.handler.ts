import { HttpException, HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IScreeningTask } from '@gauzy/contracts';
import { ScreeningTasksService } from '../../screening-tasks.service';
import { ScreeningTaskUpdateCommand } from '../screening-task.update.command';

@CommandHandler(ScreeningTaskUpdateCommand)
export class ScreeningTaskUpdateHandler implements ICommandHandler<ScreeningTaskUpdateCommand> {
	constructor(private readonly screeningTasksService: ScreeningTasksService) {}

	/**
	 * Executes the update command for a screening task.
	 *
	 * @param command - Contains the screening task ID and update input.
	 * @returns The updated screening task.
	 */
	public async execute(command: ScreeningTaskUpdateCommand): Promise<IScreeningTask> {
		try {
			const { id, input } = command;
			return await this.screeningTasksService.update(id, input);
		} catch (error) {
			throw new HttpException('Screening task update failed', HttpStatus.BAD_REQUEST);
		}
	}
}
