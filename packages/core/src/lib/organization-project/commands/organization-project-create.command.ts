import { ICommand } from '@nestjs/cqrs';
import { IOrganizationProjectCreateInput } from '@gauzy/contracts';

export class OrganizationProjectCreateCommand implements ICommand {
	static readonly type = '[Organization Project] Create';

	constructor(readonly input: IOrganizationProjectCreateInput) {}
}
