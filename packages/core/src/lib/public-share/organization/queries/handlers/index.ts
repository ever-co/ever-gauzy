import { FindPublicClientsByOrganizationHandler } from "./find-public-clients-by-organization.handler";
import { FindPublicOrganizationHandler } from "./find-public-organization.handler";

export const QueryHandlers = [
	FindPublicClientsByOrganizationHandler,
	FindPublicOrganizationHandler
];
