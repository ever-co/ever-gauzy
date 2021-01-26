import { ICommand } from '@nestjs/cqrs';
import { ITenant } from '@gauzy/contracts';

export class TenantRoleBulkCreateCommand implements ICommand {
	static readonly type = '[Role] Bulk Create';

	constructor(public readonly input: ITenant[]) {}
}
