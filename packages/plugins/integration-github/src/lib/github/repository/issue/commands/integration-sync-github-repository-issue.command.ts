import { ICommand } from '@nestjs/cqrs';
import { IGithubIssue, IIntegrationMapSyncBase, IOrganizationGithubRepository } from '@gauzy/contracts';

export class IntegrationSyncGithubRepositoryIssueCommand implements ICommand {
	static readonly type = '[Integration] Sync Github Repository Issue';

	constructor(
		public readonly input: IIntegrationMapSyncBase,
		public readonly repositoryId: IOrganizationGithubRepository['repositoryId'],
		public readonly issue: IGithubIssue
	) {}
}
