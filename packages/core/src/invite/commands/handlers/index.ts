import { InviteAcceptCandidateHandler } from './invite.accept-candidate.handler';
import { InviteAcceptEmployeeHandler } from './invite.accept-employee.handler';
import { InviteAcceptHandler } from './invite-accept.handler';
import { InviteAcceptOrganizationContactHandler } from './invite.accept-organization-contact.handler';
import { InviteAcceptUserHandler } from './invite.accept-user.handler';
import { InviteBulkCreateHandler } from './invite.bulk.create.handler';
import { InviteOrganizationContactHandler } from './invite.organization-contact.handler';
import { InviteResendHandler } from './invite.resend.handler';

export const CommandHandlers = [
	InviteAcceptCandidateHandler,
	InviteAcceptEmployeeHandler,
	InviteAcceptHandler,
	InviteAcceptOrganizationContactHandler,
	InviteAcceptUserHandler,
	InviteBulkCreateHandler,
	InviteOrganizationContactHandler,
	InviteResendHandler,
];