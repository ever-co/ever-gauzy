import { ChangelogCreateHandler } from './handlers/changelog.create.handler';
import { ChangelogUpdateHandler } from './handlers/changelog.update.handler';

export * from './changelog.create.command';
export * from './changelog.update.command';

export const CommandHandlers = [ChangelogCreateHandler, ChangelogUpdateHandler];
