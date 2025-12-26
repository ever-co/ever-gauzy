import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class GetPluginTenantByPluginQuery implements IQuery {
	constructor(
		public readonly pluginId: ID,
		public readonly tenantId: ID,
		public readonly organizationId?: ID
	) {}
}
