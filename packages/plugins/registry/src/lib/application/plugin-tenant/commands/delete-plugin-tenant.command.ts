import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class DeletePluginTenantCommand implements ICommand {
	public static readonly type = '[Plugin Tenant] Delete';

	constructor(public readonly id: ID) {}
}
