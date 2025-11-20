import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class GetPluginTenantsByPluginQuery implements IQuery {
	public static readonly type = '[Plugin Tenant] Get By Plugin';

	constructor(public readonly pluginId: ID, public readonly skip?: number, public readonly take?: number) {}
}
