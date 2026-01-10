import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class GetPluginTenantsByTenantQuery implements IQuery {
	public static readonly type = '[Plugin Tenant] Get By Tenant';

	constructor(
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly skip?: number,
		public readonly take?: number
	) {}
}
