import { ICommand } from '@nestjs/cqrs';
import { UserOrganizationDeleteInput } from '@gauzy/models';

export class UserOrganizationDeleteCommand implements ICommand {
	static readonly type = '[UserOrganization] Delete';

	constructor(public readonly input: UserOrganizationDeleteInput) {}
}
