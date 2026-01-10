import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class GetSubscriptionAccessQuery implements IQuery {
	public static readonly type = '[Plugin Subscription Access] Get Access';

	constructor(
		public readonly pluginId: ID,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
