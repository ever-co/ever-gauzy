import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class EnablePluginTenantCommand implements ICommand {
	public static readonly type = '[Plugin Tenant] Enable';

	constructor(public readonly id: ID) {}
}
