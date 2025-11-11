import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

/**
 * Command to assign users to a plugin
 */
export class AssignUsersToPluginCommand implements ICommand {
	public static readonly type = '[Plugin User Assignment] Assign Users To Plugin';

	constructor(
		public readonly pluginId: ID,
		public readonly userIds: string[],
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly reason?: string
	) {}
}

/**
 * Command to unassign users from a plugin
 */
export class UnassignUsersFromPluginCommand implements ICommand {
	public static readonly type = '[Plugin User Assignment] Unassign Users From Plugin';

	constructor(
		public readonly pluginId: ID,
		public readonly userIds: string[],
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly reason?: string
	) {}
}

/**
 * Command to bulk assign users to multiple plugins
 */
export class BulkAssignUsersToPluginsCommand implements ICommand {
	public static readonly type = '[Plugin User Assignment] Bulk Assign Users To Plugins';

	constructor(
		public readonly pluginIds: ID[],
		public readonly userIds: string[],
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly reason?: string
	) {}
}
