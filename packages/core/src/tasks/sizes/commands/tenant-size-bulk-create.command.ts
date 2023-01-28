import { ICommand } from '@nestjs/cqrs';
import { ITenant } from '@gauzy/contracts';

export class TenantSizeBulkCreateCommand implements ICommand {
	static readonly type = '[Tenant Size] Bulk Create';

	constructor(
		public readonly tenants: ITenant[]
	) { }
}
