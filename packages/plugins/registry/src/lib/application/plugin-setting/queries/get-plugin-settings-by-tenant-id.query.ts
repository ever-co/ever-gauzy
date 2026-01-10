import { IQuery } from '@nestjs/cqrs';

export class GetPluginSettingsByTenantIdQuery implements IQuery {
	public static readonly type = '[Plugin Setting] Get By Tenant ID';

	constructor(
		public readonly pluginTenantId: string,
		public readonly relations?: string[],
		public readonly tenantId?: string,
		public readonly organizationId?: string
	) {}
}
