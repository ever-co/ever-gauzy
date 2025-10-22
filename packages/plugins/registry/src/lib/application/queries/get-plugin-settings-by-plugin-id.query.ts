import { IQuery } from '@nestjs/cqrs';

export class GetPluginSettingsByPluginIdQuery implements IQuery {
	public static readonly type = '[Plugin Setting] Get By Plugin ID';

	constructor(
		public readonly pluginId: string,
		public readonly relations?: string[],
		public readonly tenantId?: string,
		public readonly organizationId?: string
	) {}
}
