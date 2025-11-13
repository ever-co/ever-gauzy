import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class CheckUserSubscriptionAccessQuery implements IQuery {
	public static readonly type = '[Plugin Subscription Access] Check User Access';

	constructor(
		public readonly pluginId: ID,
		public readonly userId: ID,
		public readonly tenantId: ID,
		public readonly organizationId?: ID
	) {}
}
