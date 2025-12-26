import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class UpgradePluginSubscriptionCommand implements ICommand {
	public static readonly type = '[Plugin Subscription] Upgrade';

	constructor(
		public readonly subscriptionId: ID,
		public readonly newPlanId: ID,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
