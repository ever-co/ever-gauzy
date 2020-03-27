import { ICommand } from '@nestjs/cqrs';
import { LinkClientOrganizationInviteInput } from '@gauzy/models';

export class InviteLinkOrganizationClientsCommand implements ICommand {
	static readonly type = '[OrganizationClients] Link Invite';

	constructor(public readonly input: LinkClientOrganizationInviteInput) {}
}
