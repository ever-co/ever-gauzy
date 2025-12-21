import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class GetActivePluginSubscriptionQuery implements IQuery {
	public static readonly type = '[Plugin Subscription] Get Active';

	constructor(
		public readonly pluginId: ID,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly subscriberId?: ID
	) {}
}
