import { ICommand } from '@nestjs/cqrs';
import { IOrganizationProject } from '@gauzy/contracts';

export class OrganizationProjectPriorityBulkCreateCommand implements ICommand {
	static readonly type = '[Organization Project Priority] Bulk Create';

	constructor(
		public readonly input: IOrganizationProject
	) {}
}
