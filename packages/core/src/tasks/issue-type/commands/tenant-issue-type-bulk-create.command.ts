import { ICommand } from '@nestjs/cqrs';
import { ITenant } from '@gauzy/contracts';

export class TenantIssueTypeBulkCreateCommand implements ICommand {
	static readonly type = '[Tenant] Issue Type Bulk Create';

	constructor(public readonly tenants: ITenant[]) {}
}
