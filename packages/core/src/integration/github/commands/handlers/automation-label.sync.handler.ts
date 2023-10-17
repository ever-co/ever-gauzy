import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import * as chalk from 'chalk';
import { AutomationLabelSyncCommand } from './../automation-label.sync.command';
import { GithubSyncService } from './../../github-sync.service';

@CommandHandler(AutomationLabelSyncCommand)
export class AutomationLabelSyncHandler implements ICommandHandler<AutomationLabelSyncCommand> {
	constructor(
		private readonly _githubSyncService: GithubSyncService
	) { }

	async execute(command: AutomationLabelSyncCommand): Promise<void> {
		try {
			const { input } = command;
			console.log(
				chalk.magenta(
					`Execution Create/Update Automation Label Command: ${chalk.magenta(JSON.stringify(JSON.stringify(input)))}`
				)
			);
			// await this._githubSyncService.syncAutomationIssue(input);
		} catch (error) {
			console.log('Failed to sync in issues and labels', error.message);
		}
	}
}
