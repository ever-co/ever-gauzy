import { ICommand } from '@nestjs/cqrs';
import { OrganizationClientsCreateInput as IOrganizationClientsCreateInput } from '@gauzy/models';

export class OrganizationClientsCreateCommand implements ICommand {
	static readonly type = '[OrganizationClients] Create Organization Client';

	constructor(public readonly input: IOrganizationClientsCreateInput) {}
}
