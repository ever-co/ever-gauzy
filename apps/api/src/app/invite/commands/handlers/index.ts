import { InviteAcceptEmployeeHandler } from './invite.accept-employee.handler';
import { InviteAcceptUserHandler } from './invite.accept-user.handler';
import { InviteResendHandler } from './invite.resend.handler';
import { InviteOrganizationClientsHandler } from './invite.organization-clients.handler';
import { InviteAcceptOrganizationClientHandler } from './invite.accept-organization-client.handler';

export const CommandHandlers = [
	InviteAcceptEmployeeHandler,
	InviteAcceptUserHandler,
	InviteAcceptOrganizationClientHandler,
	InviteResendHandler,
	InviteOrganizationClientsHandler
];
