import { ICommand } from '@nestjs/cqrs';
import { IOrganizationSprintCreateInput } from '@gauzy/contracts';

export class OrganizationSprintCreateCommand implements ICommand {
	static readonly type = '[Organization Sprint] Create';

	constructor(readonly input: IOrganizationSprintCreateInput) {}
}
