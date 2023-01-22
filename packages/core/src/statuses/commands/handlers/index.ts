import { OrganizationProjectStatusBulkCreateHandler } from './organization-project-status-bulk-create.handler';
import { OrganizationStatusBulkCreateHandler } from './organization-status-bulk-create.handler';
import { TenantStatusBulkCreateHandler } from './tenant-status-bulk-create.handler';

export const CommandHandlers = [
    OrganizationProjectStatusBulkCreateHandler,
    OrganizationStatusBulkCreateHandler,
    TenantStatusBulkCreateHandler,
];
