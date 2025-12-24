import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class ExtendTrialSubscriptionCommand implements ICommand {
	public static readonly type = '[Plugin Subscription] Extend Trial';

	constructor(
		public readonly subscriptionId: ID,
		public readonly days: number,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
