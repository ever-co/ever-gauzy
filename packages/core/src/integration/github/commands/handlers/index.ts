import { GithubTaskOpenedCommandHandler } from './task.opened.handler';
import { IntegrationSyncGithubRepositoryCommandHandler } from './integration-sync-github-repository.handler';

export const CommandHandlers = [
    GithubTaskOpenedCommandHandler,
    IntegrationSyncGithubRepositoryCommandHandler
];
