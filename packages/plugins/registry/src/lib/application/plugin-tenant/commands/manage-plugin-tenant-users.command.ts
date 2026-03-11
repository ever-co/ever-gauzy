import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

/**
 * Operation type for managing plugin tenant users
 */
export type PluginTenantUserOperation = 'allow' | 'deny' | 'remove-allowed' | 'remove-denied' | 'unassign';

/**
 * Command to manage allowed/denied/unassigned users for a plugin tenant.
 * Supports operations: allow, deny, remove-allowed, remove-denied, unassign.
 */
export class ManagePluginTenantUsersCommand implements ICommand {
	public static readonly type = '[Plugin Tenant] Manage Users';

	constructor(
		public readonly pluginTenantId: ID,
		public readonly userIds: string[],
		public readonly operation: PluginTenantUserOperation,
		public readonly reason?: string
	) {}
}
