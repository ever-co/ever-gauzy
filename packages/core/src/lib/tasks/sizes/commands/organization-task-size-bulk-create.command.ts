import { ICommand } from '@nestjs/cqrs';
import { IOrganization } from '@gauzy/contracts';

export class OrganizationTaskSizeBulkCreateCommand implements ICommand {
	static readonly type = '[Organization] Task Size Bulk Create';

	constructor(
		public readonly input: IOrganization
	) { }
}
