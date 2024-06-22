import { i4netCloudOrganizationMigrateHandler } from './gauzy-cloud-organization.migrate.handler';
import { i4netCloudTenantMigrateHandler } from './gauzy-cloud-tenant.migrate.handler';
import { i4netCloudUserMigrateHandler } from './gauzy-cloud-user.migrate.handler';

export const CommandHandlers = [
    i4netCloudUserMigrateHandler,
    i4netCloudTenantMigrateHandler,
    i4netCloudOrganizationMigrateHandler
];
