import { InviteAcceptEmployeeHandler } from './invite.accept-employee.handler';
import { InviteAcceptUserHandler } from './invite.accept-user.handler';
import { InviteResendHandler } from './invite.resend.handler';
import { InviteOrganizationContactsHandler } from './invite.organization-contacts.handler';
import { InviteLinkOrganizationContactsHandler } from './invite.link-organization-contacts.handler';

export const CommandHandlers = [
	InviteAcceptEmployeeHandler,
	InviteAcceptUserHandler,
	InviteResendHandler,
	InviteOrganizationContactsHandler,
	InviteLinkOrganizationContactsHandler
];
