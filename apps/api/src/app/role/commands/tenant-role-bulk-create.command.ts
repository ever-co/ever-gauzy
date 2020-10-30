import { ICommand } from '@nestjs/cqrs';
import { ITenant } from '@gauzy/models';

export class TenantRoleBulkCreateCommand implements ICommand {
	static readonly type = '[Role] Bulk Create';

	constructor(public readonly input: ITenant[]) {}
}
