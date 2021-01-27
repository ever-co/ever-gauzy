import { IOrganizationSprintUpdateInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class OrganizationSprintUpdateCommand implements ICommand {
	static readonly type = '[OrganizationSprint] Update';

	constructor(
		public readonly id: string,
		public readonly input: IOrganizationSprintUpdateInput
	) {}
}
