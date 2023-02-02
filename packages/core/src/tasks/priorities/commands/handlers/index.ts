import { OrganizationProjectTaskPriorityBulkCreateHandler } from './organization-project-task-priority-bulk-create.handler';
import { OrganizationTaskPriorityBulkCreateHandler } from './organization-task-priority-bulk-create.handler';
import { TenantTaskPriorityBulkCreateHandler } from './tenant-task-priority-bulk-create.handler';

export const CommandHandlers = [
    OrganizationProjectTaskPriorityBulkCreateHandler,
    OrganizationTaskPriorityBulkCreateHandler,
    TenantTaskPriorityBulkCreateHandler,
];
