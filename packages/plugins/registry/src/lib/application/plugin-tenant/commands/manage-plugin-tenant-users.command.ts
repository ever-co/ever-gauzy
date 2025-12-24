import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

/**
 * Operation type for managing plugin tenant users
 */
export type PluginTenantUserOperation = 'allow' | 'deny' | 'remove-allowed' | 'remove-denied';

/**
 * Command to manage allowed/denied users for a plugin tenant
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
