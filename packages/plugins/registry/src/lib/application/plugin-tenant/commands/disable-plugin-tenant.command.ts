import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class DisablePluginTenantCommand implements ICommand {
	public static readonly type = '[Plugin Tenant] Disable';

	constructor(public readonly id: ID) {}
}
