import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as chalk from 'chalk';
import { AutomationTaskSyncCommand } from './../automation-task.sync.command';
import { Task } from '../../task.entity';

@CommandHandler(AutomationTaskSyncCommand)
export class AutomationTaskSyncHandler implements ICommandHandler<AutomationTaskSyncCommand> {

	constructor(
		@InjectRepository(Task)
		private readonly repository: Repository<Task>
	) { }

	async execute(command: AutomationTaskSyncCommand): Promise<void> {
		try {
			const { input } = command;
			console.log(
				chalk.magenta(
					`Execution Create/Update Automation Issue Command: ${chalk.magenta(JSON.stringify(JSON.stringify(input)))}`
				),
				await this.repository.find()
			);
			// await this._githubSyncService.syncAutomationIssue(input);
		} catch (error) {
			console.log('Failed to sync in issues and labels', error.message);
		}
	}
}
