import { GithubTaskUpdateOrCreateCommandHandler } from './task.update-or-create.handler';
import { IntegrationSyncGithubRepositoryCommandHandler } from './integration-sync-github-repository.handler';
import { IntegrationSyncGithubRepositoryIssueCommandHandler } from './../../repository/issue/commands/handlers';

export const CommandHandlers = [
    GithubTaskUpdateOrCreateCommandHandler,
    IntegrationSyncGithubRepositoryCommandHandler,
    IntegrationSyncGithubRepositoryIssueCommandHandler
];
