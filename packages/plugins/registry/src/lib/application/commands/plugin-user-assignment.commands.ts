import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

/**
 * Command to assign users to a plugin installation
 */
export class AssignUsersToPluginCommand implements ICommand {
	public static readonly type = '[Plugin User Assignment] Assign Users';

	constructor(
		public readonly pluginInstallationId: ID,
		public readonly userIds: ID[],
		public readonly reason?: string
	) {}
}

/**
 * Command to unassign users from a plugin installation
 */
export class UnassignUsersFromPluginCommand implements ICommand {
	public static readonly type = '[Plugin User Assignment] Unassign Users';

	constructor(
		public readonly pluginInstallationId: ID,
		public readonly userIds: ID[],
		public readonly revocationReason?: string
	) {}
}

/**
 * Command to bulk assign users to multiple plugin installations
 */
export class BulkAssignUsersToPluginsCommand implements ICommand {
	public static readonly type = '[Plugin User Assignment] Bulk Assign Users';

	constructor(
		public readonly pluginInstallationIds: ID[],
		public readonly userIds: ID[],
		public readonly reason?: string
	) {}
}
