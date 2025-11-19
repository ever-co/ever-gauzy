import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { CreatePluginSubscriptionPlanDTO } from '../../../shared';

export class CreatePluginSubscriptionPlanCommand implements ICommand {
	public static readonly type = '[Plugin Subscription Plan] Create';

	constructor(
		public readonly createDto: CreatePluginSubscriptionPlanDTO,
		public readonly tenantId?: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
