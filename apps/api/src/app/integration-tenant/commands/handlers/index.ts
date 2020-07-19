import { IntegrationTenantCreateHandler } from './integration-tenant.create.handler';
import { IntegrationTenantGetHandler } from './integration-tenant.get.handler';

export const CommandHandlers = [
	IntegrationTenantCreateHandler,
	IntegrationTenantGetHandler
];
