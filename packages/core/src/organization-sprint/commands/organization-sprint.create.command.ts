import { ICommand } from '@nestjs/cqrs';
import { IOrganizationSprintCreateInput } from '@gauzy/contracts';

export class OrganizationSprintCreateCommand implements ICommand {
	static readonly type = '[OrganizationSprint] Create';

	constructor(readonly input: IOrganizationSprintCreateInput) {}
}
