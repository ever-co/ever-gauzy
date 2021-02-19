import { ChangelogCreateHandler } from './handlers/changelog.create.handler';
import { ChangelogUpdateHandler } from './handlers/changelog.update.handler';

export { ChangelogCreateCommand } from './changelog.create.command';
export { ChangelogUpdateCommand } from './changelog.update.command';

export const CommandHandlers = [ChangelogCreateHandler, ChangelogUpdateHandler];
