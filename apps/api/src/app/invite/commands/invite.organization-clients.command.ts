import { ICommand } from '@nestjs/cqrs';
import { OrganizationClientsInviteInput } from '@gauzy/models';

export class InviteOrganizationClientsCommand implements ICommand {
	static readonly type = '[OrganizationClients] Invite';

	constructor(public readonly input: OrganizationClientsInviteInput) {}
}
