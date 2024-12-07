import { IntegrationTenantCreateHandler } from './integration-tenant.create.handler';
import { IntegrationTenantDeleteHandler } from './integration-tenant.delete.handler';
import { IntegrationTenantGetHandler } from './integration-tenant.get.handler';
import { IntegrationTenantUpdateHandler } from './integration-tenant.update.handler';
import { IntegrationTenantUpdateOrCreateHandler } from './integration-tenant-update-or-create.handler';

export const CommandHandlers = [
	IntegrationTenantCreateHandler,
	IntegrationTenantDeleteHandler,
	IntegrationTenantGetHandler,
	IntegrationTenantUpdateHandler,
	IntegrationTenantUpdateOrCreateHandler
];
