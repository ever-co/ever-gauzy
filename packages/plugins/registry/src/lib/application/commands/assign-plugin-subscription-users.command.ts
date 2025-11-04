import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { AssignPluginSubscriptionDTO } from '../../shared/dto/plugin-subscription-assignment.dto';

export class AssignPluginSubscriptionUsersCommand implements ICommand {
	public static readonly type = '[Plugin Subscription Access] Assign Users';

	constructor(
		public readonly pluginId: ID,
		public readonly assignDto: AssignPluginSubscriptionDTO,
		public readonly tenantId: ID,
		public readonly organizationId: ID,
		public readonly requestingUserId: ID
	) {}
}
