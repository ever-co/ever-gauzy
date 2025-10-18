import { IQuery } from '@nestjs/cqrs';

export class GetActivePluginSubscriptionQuery implements IQuery {
	public static readonly type = '[Plugin Subscription] Get Active';

	constructor(
		public readonly pluginId: string,
		public readonly tenantId: string,
		public readonly organizationId?: string,
		public readonly subscriberId?: string
	) {}
}
