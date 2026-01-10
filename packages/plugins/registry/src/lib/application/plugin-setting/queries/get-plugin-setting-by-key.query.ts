import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class GetPluginSettingsByKeyQuery implements IQuery {
	public static readonly type = '[Plugin Setting] Get By Key';

	constructor(
		public readonly pluginId: ID,
		public readonly key: string,
		public readonly pluginTenantId?: ID,
		public readonly relations?: string[],
		public readonly tenantId?: ID,
		public readonly organizationId?: ID
	) {}
}
