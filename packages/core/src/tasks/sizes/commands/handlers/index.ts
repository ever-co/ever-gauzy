import { OrganizationTaskProjectSizeBulkCreateHandler } from './organization-project-task-size-bulk-create.handler';
import { OrganizationTaskSizeBulkCreateHandler } from './organization-task-size-bulk-create.handler';
import { OrganizationTeamTaskSizeBulkCreateHandler } from './organization-team-task-size-bulk-create.handle';
import { TenantTaskSizeBulkCreateHandler } from './tenant-task-size-bulk-create.handler';

export const CommandHandlers = [
    OrganizationTaskProjectSizeBulkCreateHandler,
    OrganizationTaskSizeBulkCreateHandler,
    TenantTaskSizeBulkCreateHandler,
    OrganizationTeamTaskSizeBulkCreateHandler
];
