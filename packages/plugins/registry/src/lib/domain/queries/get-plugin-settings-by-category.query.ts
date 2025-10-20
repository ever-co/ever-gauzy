import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class GetPluginSettingsByCategoryQuery implements IQuery {
	public static readonly type = '[Plugin Setting] Get By Category';

	constructor(
		public readonly pluginId: ID,
		public readonly categoryId: ID,
		public readonly pluginTenantId?: ID,
		public readonly relations?: string[],
		public readonly tenantId?: ID,
		public readonly organizationId?: ID
	) {}
}
