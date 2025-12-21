import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class GetPluginTenantQuotaInfoQuery implements IQuery {
	public static readonly type = '[Plugin Tenant] Get Quota Info';

	constructor(public readonly pluginTenantId: ID) {}
}
