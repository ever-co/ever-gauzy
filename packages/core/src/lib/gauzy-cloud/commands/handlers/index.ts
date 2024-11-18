import { GauzyCloudOrganizationMigrateHandler } from './gauzy-cloud-organization.migrate.handler';
import { GauzyCloudTenantMigrateHandler } from './gauzy-cloud-tenant.migrate.handler';
import { GauzyCloudUserMigrateHandler } from './gauzy-cloud-user.migrate.handler';

export const CommandHandlers = [
    GauzyCloudUserMigrateHandler,
    GauzyCloudTenantMigrateHandler,
    GauzyCloudOrganizationMigrateHandler
];
