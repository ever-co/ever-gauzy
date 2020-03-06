import { ICommand } from '@nestjs/cqrs';
import { OrganizationClientsInviteInput } from '@gauzy/models';

export class OrganizationClientsInviteCommand implements ICommand {
	static readonly type = '[OrganizationClients] Invite';

	constructor(public readonly input: OrganizationClientsInviteInput) {}
}
