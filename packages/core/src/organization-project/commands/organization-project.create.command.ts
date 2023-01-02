import { ICommand } from '@nestjs/cqrs';
import { IOrganizationProjectsCreateInput } from '@gauzy/contracts';

export class OrganizationProjectCreateCommand implements ICommand {
	static readonly type = '[Organization Project] Create';

	constructor(
		public readonly input: IOrganizationProjectsCreateInput
	) {}
}
