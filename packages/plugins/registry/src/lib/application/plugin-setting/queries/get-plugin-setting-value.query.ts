import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class GetPluginSettingValueQuery implements IQuery {
	public static readonly type = '[Plugin Setting] Get Value';

	constructor(
		public readonly pluginId: ID,
		public readonly key: string,
		public readonly pluginTenantId?: ID,
		public readonly tenantId?: ID,
		public readonly organizationId?: ID
	) {}
}
