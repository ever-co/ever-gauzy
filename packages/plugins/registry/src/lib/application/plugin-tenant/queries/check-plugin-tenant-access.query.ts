import { ID, IRole } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class CheckPluginTenantAccessQuery implements IQuery {
	public static readonly type = '[Plugin Tenant] Check Access';

	constructor(
		public readonly userId: ID,
		public readonly pluginId: ID,
		public readonly userRoles: IRole[],
		public readonly tenantId?: ID,
		public readonly organizationId?: ID
	) {}
}
