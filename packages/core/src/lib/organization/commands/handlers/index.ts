import { OrganizationCreateHandler } from './organization.create.handler';
import { OrganizationUpdateHandler } from './organization.update.handler';

export const CommandHandlers = [
	OrganizationCreateHandler,
	OrganizationUpdateHandler
];
