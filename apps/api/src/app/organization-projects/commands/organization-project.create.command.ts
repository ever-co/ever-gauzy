import { ICommand } from '@nestjs/cqrs';
import { OrganizationProjectsCreateInput } from '@gauzy/models';

export class OrganizationProjectCreateCommand implements ICommand {
	static readonly type = '[OrganizationProject] Create Project';

	constructor(public readonly input: OrganizationProjectsCreateInput) {}
}
