import { ICommand } from '@nestjs/cqrs';
import { IOrganizationProjectsUpdateInput } from '@gauzy/contracts';

export class OrganizationProjectUpdateCommand implements ICommand {
	static readonly type = '[Organization Project] Update';

	constructor(
		public readonly input: IOrganizationProjectsUpdateInput
	) {}
}
