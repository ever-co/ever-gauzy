import { OrganizationProjectSizeBulkCreateHandler } from './organization-project-size-bulk-create.handler';
import { TenantSizeBulkCreateHandler } from './tenant-size-bulk-create.handler';

export const CommandHandlers = [
    OrganizationProjectSizeBulkCreateHandler,
    TenantSizeBulkCreateHandler
];
