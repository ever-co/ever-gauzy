import { GithubTaskUpdateOrCreateCommandHandler } from './task.update-or-create.handler';
import { IntegrationSyncGithubRepositoryCommandHandler } from './integration-sync-github-repository.handler';

export const CommandHandlers = [
    GithubTaskUpdateOrCreateCommandHandler,
    IntegrationSyncGithubRepositoryCommandHandler
];
