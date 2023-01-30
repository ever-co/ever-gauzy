import { ICommand } from '@nestjs/cqrs';
import { ITenant } from '@gauzy/contracts';

export class TenantTaskPriorityBulkCreateCommand implements ICommand {
	static readonly type = '[Tenant] Task Priority Bulk Create';

	constructor(
		public readonly tenants: ITenant[]
	) { }
}
