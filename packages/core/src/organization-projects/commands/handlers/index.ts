import { OrganizationProjectEditByEmployeeHandler } from './organization-project.edit-by-employee.handler';
import { OrganizationProjectCreateHandler } from './organization-project.create.handler';
import { OrganizationProjectUpdateHandler } from './organization-project.update.handler';

export const CommandHandlers = [
	OrganizationProjectEditByEmployeeHandler,
	OrganizationProjectCreateHandler,
	OrganizationProjectUpdateHandler
];
