import { ICommand } from '@nestjs/cqrs';
import { IOrganizationProject } from '@gauzy/contracts';

export class OrganizationProjectSizeBulkCreateCommand implements ICommand {
	static readonly type = '[Organization Project Size] Bulk Create';

	constructor(
		public readonly input: IOrganizationProject
	) { }
}
