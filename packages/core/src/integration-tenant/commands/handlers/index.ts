import { IntegrationTenantCreateHandler } from './integration-tenant.create.handler';
import { IntegrationTenantUpdateOrCreateHandler } from './integration-tenant-update-or-create.handler';
import { IntegrationTenantGetHandler } from './integration-tenant.get.handler';
import { IntegrationTenantUpdateHandler } from './integration-tenant.update.handler';

export const CommandHandlers = [
	IntegrationTenantCreateHandler,
	IntegrationTenantGetHandler,
	IntegrationTenantUpdateHandler,
	IntegrationTenantUpdateOrCreateHandler
];
