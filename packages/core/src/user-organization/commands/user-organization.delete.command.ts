import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class UserOrganizationDeleteCommand implements ICommand {
	static readonly type = '[UserOrganization] Delete';

	constructor(public readonly userOrganizationId: ID) {}
}
