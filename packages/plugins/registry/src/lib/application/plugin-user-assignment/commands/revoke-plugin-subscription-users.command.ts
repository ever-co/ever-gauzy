import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { RevokePluginSubscriptionAssignmentDTO } from '../../../shared';

export class RevokePluginSubscriptionUsersCommand implements ICommand {
	public static readonly type = '[Plugin Subscription Access] Revoke Users';

	constructor(
		public readonly pluginId: ID,
		public readonly revokeDto: RevokePluginSubscriptionAssignmentDTO,
		public readonly tenantId: ID,
		public readonly organizationId: ID,
		public readonly requestingUserId: ID
	) {}
}
