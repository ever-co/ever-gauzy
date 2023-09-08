import { ICommand } from '@nestjs/cqrs';
import { IOrganizationProjectUpdateInput } from '@gauzy/contracts';

export class OrganizationProjectUpdateCommand implements ICommand {
	static readonly type = '[Organization Project] Update';

	constructor(
		public readonly input: IOrganizationProjectUpdateInput
	) { }
}
