import { AutomationLabelSyncHandler } from './automation-label.sync.handler';
import { OrganizationTeamTagBulkCreateHandler } from './organization-team-tag-bulk-create.handler';
import { TagCreateHandler } from './tag-create.handler';
import { TagListHandler } from './tag.list.handler';
import { TagUpdateHandler } from './tag-update.handler';

export const CommandHandlers = [
	AutomationLabelSyncHandler,
	OrganizationTeamTagBulkCreateHandler,
	TagCreateHandler,
	TagListHandler,
	TagUpdateHandler
];
