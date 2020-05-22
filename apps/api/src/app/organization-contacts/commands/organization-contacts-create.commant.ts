import { ICommand } from '@nestjs/cqrs';
import { OrganizationContactsCreateInput as IOrganizationContactsCreateInput } from '@gauzy/models';

export class OrganizationContactsCreateCommand implements ICommand {
	static readonly type = '[OrganizationContacts] Create Organization Contact';

	constructor(public readonly input: IOrganizationContactsCreateInput) {}
}
