import { InviteAcceptEmployeeHandler } from './invite.accept-employee.handler';
import { InviteAcceptUserHandler } from './invite.accept-user.handler';
import { InviteResendHandler } from './invite.resend.handler';
import { InviteOrganizationContactHandler } from './invite.organization-contact.handler';
import { InviteAcceptOrganizationContactHandler } from './invite.accept-organization-contact.handler';

export const CommandHandlers = [
	InviteAcceptEmployeeHandler,
	InviteAcceptUserHandler,
	InviteAcceptOrganizationContactHandler,
	InviteResendHandler,
	InviteOrganizationContactHandler
];
