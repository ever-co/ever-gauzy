import { ICommand } from '@nestjs/cqrs';
import { OrganizationContactsInviteInput } from '@gauzy/models';

export class InviteOrganizationContactsCommand implements ICommand {
	static readonly type = '[OrganizationContacts] Invite';

	constructor(public readonly input: OrganizationContactsInviteInput) {}
}
