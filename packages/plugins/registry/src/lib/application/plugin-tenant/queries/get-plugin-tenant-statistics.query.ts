import { IQuery } from '@nestjs/cqrs';

export class GetPluginTenantStatisticsQuery implements IQuery {
	public static readonly type = '[Plugin Tenant] Get Statistics';

	constructor(public readonly tenantId?: string, public readonly organizationId?: string) {}
}
