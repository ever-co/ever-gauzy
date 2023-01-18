import { ICommand } from '@nestjs/cqrs';
import { ITenant } from '@gauzy/contracts';

export class TenantStatusBulkCreateCommand implements ICommand {
	static readonly type = '[Status] Bulk Create';

	constructor(public readonly tenants: ITenant[]) {}
}
