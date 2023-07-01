import { OrganizationProjectVersionBulkCreateHandler } from './organization-project-version-bulk-create.handler';
import { OrganizationVersionBulkCreateHandler } from './organization-version-bulk-create.handler';
import { OrganizationTeamTaskVersionBulkCreateHandler } from './organization-team-task-version-bulk-create.handle';
import { TenantVersionBulkCreateHandler } from './tenant-version-bulk-create.handler';

export const CommandHandlers = [
	OrganizationProjectVersionBulkCreateHandler,
	OrganizationVersionBulkCreateHandler,
	OrganizationTeamTaskVersionBulkCreateHandler,
	TenantVersionBulkCreateHandler
];
