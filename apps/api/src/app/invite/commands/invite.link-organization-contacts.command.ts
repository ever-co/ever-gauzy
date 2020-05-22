import { ICommand } from '@nestjs/cqrs';
import { LinkClientOrganizationInviteInput } from '@gauzy/models';

export class InviteLinkOrganizationContactsCommand implements ICommand {
	static readonly type = '[OrganizationContacts] Link Invite';

	constructor(public readonly input: LinkClientOrganizationInviteInput) {}
}
