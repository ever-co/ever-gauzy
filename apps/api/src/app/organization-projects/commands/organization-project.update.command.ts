import { ICommand } from '@nestjs/cqrs';
import { OrganizationProjectsUpdateInput } from '@gauzy/models';

export class OrganizationProjectUpdateCommand implements ICommand {
	static readonly type = '[OrganizationProject] Update Project';

	constructor(public readonly input: OrganizationProjectsUpdateInput) {}
}
