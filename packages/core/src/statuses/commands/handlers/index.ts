import { OrganizationStatusBulkCreateHandler } from './organization-status-bulk-create.handler';
import { TenantStatusBulkCreateHandler } from './tenant-status-bulk-create.handler';

export const CommandHandlers = [
    OrganizationStatusBulkCreateHandler,
    TenantStatusBulkCreateHandler,
];
