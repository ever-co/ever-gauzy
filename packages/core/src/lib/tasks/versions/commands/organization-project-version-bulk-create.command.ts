import { ICommand } from '@nestjs/cqrs';
import { IOrganizationProject } from '@gauzy/contracts';

export class OrganizationProjectVersionBulkCreateCommand implements ICommand {
	static readonly type = '[Organization Project] Task Version Bulk Create';

	constructor(public readonly input: IOrganizationProject) {}
}
