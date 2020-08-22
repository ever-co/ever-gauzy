import { ICommand } from '@nestjs/cqrs';
import { OrganizationContactCreateInput as IOrganizationContactCreateInput } from '@gauzy/models';

export class OrganizationContactCreateCommand implements ICommand {
	static readonly type = '[OrganizationContact] Create Organization Contact';

	constructor(public readonly input: IOrganizationContactCreateInput) {}
}
