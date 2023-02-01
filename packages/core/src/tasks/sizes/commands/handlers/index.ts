import { OrganizationTaskProjectSizeBulkCreateHandler } from './organization-project-task-size-bulk-create.handler';
import { OrganizationTaskSizeBulkCreateHandler } from './organization-task-size-bulk-create.handler';
import { TenantTaskSizeBulkCreateHandler } from './tenant-task-size-bulk-create.handler';

export const CommandHandlers = [
    OrganizationTaskProjectSizeBulkCreateHandler,
    OrganizationTaskSizeBulkCreateHandler,
    TenantTaskSizeBulkCreateHandler,
];
