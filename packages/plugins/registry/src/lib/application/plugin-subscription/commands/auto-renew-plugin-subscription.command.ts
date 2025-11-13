import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class AutoRenewPluginSubscriptionCommand implements ICommand {
	public static readonly type = '[Plugin Subscription] Auto Renew';

	constructor(
		public readonly subscriptionId: ID,
		public readonly tenantId: ID,
		public readonly organizationId?: ID
	) {}
}
