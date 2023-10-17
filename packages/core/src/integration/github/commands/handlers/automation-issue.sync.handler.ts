import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import * as chalk from 'chalk';
import { AutomationIssueSyncCommand } from '../automation-issue.sync.command';
import { GithubSyncService } from '../../github-sync.service';

@CommandHandler(AutomationIssueSyncCommand)
export class AutomationIssueSyncHandler implements ICommandHandler<AutomationIssueSyncCommand> {

	constructor(
		private readonly _githubSyncService: GithubSyncService
	) { }

	async execute(command: AutomationIssueSyncCommand): Promise<void> {
		try {
			const { input } = command;
			console.log(
				chalk.magenta(
					`Execution Create/Update Automation Issue Command: ${chalk.magenta(JSON.stringify(JSON.stringify(input)))}`
				)
			);
			// await this._githubSyncService.syncAutomationIssue(input);
		} catch (error) {
			console.log('Failed to sync in issues and labels', error.message);
		}
	}
}
