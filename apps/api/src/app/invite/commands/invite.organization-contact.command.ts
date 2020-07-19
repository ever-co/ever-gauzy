import { ICommand } from '@nestjs/cqrs';
import { OrganizationContactInviteInput } from '@gauzy/models';

export class InviteOrganizationContactCommand implements ICommand {
	static readonly type = '[OrganizationContact] Invite';

	constructor(public readonly input: OrganizationContactInviteInput) {}
}
