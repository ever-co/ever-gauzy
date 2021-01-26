import { ICommand } from '@nestjs/cqrs';
import { IOrganizationProjectsCreateInput } from '@gauzy/contracts';

export class OrganizationProjectCreateCommand implements ICommand {
	static readonly type = '[OrganizationProject] Create Project';

	constructor(public readonly input: IOrganizationProjectsCreateInput) {}
}
