import { OrganizationProjectTaskPriorityBulkCreateHandler } from './organization-project-task-priority-bulk-create.handler';
import { OrganizationTaskPriorityBulkCreateHandler } from './organization-task-priority-bulk-create.handler';
import { OrganizationTeamTaskPriorityBulkCreateHandler } from './organization-team-task-priority-bulk-create.handle';
import { TenantTaskPriorityBulkCreateHandler } from './tenant-task-priority-bulk-create.handler';

export const CommandHandlers = [
    OrganizationProjectTaskPriorityBulkCreateHandler,
    OrganizationTaskPriorityBulkCreateHandler,
    OrganizationTeamTaskPriorityBulkCreateHandler,
    TenantTaskPriorityBulkCreateHandler
];
