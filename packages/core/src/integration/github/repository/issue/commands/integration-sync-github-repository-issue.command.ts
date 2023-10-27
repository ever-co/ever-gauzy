import { ICommand } from '@nestjs/cqrs';
import { IGithubIssue, IGithubRepository, IIntegrationMapSyncBase } from '@gauzy/contracts';

export class IntegrationSyncGithubRepositoryIssueCommand implements ICommand {
	static readonly type = '[Integration] Sync Github Repository Issue';

	constructor(
		public readonly input: IIntegrationMapSyncBase,
		public readonly repository: IGithubRepository,
		public readonly issue: IGithubIssue,
	) { }
}
