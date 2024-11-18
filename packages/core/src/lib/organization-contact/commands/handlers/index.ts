import { OrganizationContactEditByEmployeeHandler } from './organization-contact.edit-by-employee.handler';
import { OrganizationContactCreateHandler } from './organization-contact-create.handler';
import { OrganizationContactUpdateHandler } from './organization-contact-update.handler';

export const CommandHandlers = [
	OrganizationContactCreateHandler,
	OrganizationContactEditByEmployeeHandler,
	OrganizationContactUpdateHandler
];
