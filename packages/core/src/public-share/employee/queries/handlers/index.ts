import { FindOnePublicEmployeeHandler } from "./find-one-public-employee.handler";
import { FindPublicEmployeesByOrganizationHandler } from "./find-public-employees-by-organization.handler";

export const QueryHandlers = [
	FindOnePublicEmployeeHandler,
	FindPublicEmployeesByOrganizationHandler,
];