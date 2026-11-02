import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class DowngradePluginSubscriptionCommand implements ICommand {
	public static readonly type = '[Plugin Subscription] Downgrade';

	constructor(
		public readonly subscriptionId: ID,
		public readonly newPlanId: ID,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID,
		/** The plugin the route names: a subscription of another plugin is not found. */
		public readonly pluginId?: ID
	) {}
}
