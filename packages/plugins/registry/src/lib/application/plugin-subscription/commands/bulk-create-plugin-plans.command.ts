import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { CreatePluginSubscriptionPlanDTO } from '../../../shared';

export class BulkCreatePluginPlansCommand implements ICommand {
	public static readonly type = '[Plugin Subscription Plan] Create Multiple';

	constructor(
		public readonly plans: CreatePluginSubscriptionPlanDTO[],
		public readonly tenantId?: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
