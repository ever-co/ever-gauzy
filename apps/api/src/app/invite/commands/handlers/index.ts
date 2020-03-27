import { InviteAcceptEmployeeHandler } from './invite.accept-employee.handler';
import { InviteAcceptUserHandler } from './invite.accept-user.handler';
import { InviteResendHandler } from './invite.resend.handler';
import { InviteOrganizationClientsHandler } from './invite.organization-clients.handler';
import { InviteLinkOrganizationClientsHandler } from './invite.link-organization-clients.handler';

export const CommandHandlers = [
	InviteAcceptEmployeeHandler,
	InviteAcceptUserHandler,
	InviteResendHandler,
	InviteOrganizationClientsHandler,
	InviteLinkOrganizationClientsHandler
];
