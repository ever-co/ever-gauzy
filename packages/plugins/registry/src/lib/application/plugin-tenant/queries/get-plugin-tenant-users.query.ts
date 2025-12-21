import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

/**
 * Type of users to retrieve for a plugin tenant
 */
export type PluginTenantUserType = 'allowed' | 'denied' | 'all';

/**
 * Query to get users for a plugin tenant (allowed, denied, or all)
 */
export class GetPluginTenantUsersQuery implements IQuery {
	public static readonly type = '[Plugin Tenant] Get Users';

	constructor(
		public readonly pluginTenantId: ID,
		public readonly userType: PluginTenantUserType = 'all',
		public readonly skip?: number,
		public readonly take?: number,
		public readonly searchTerm?: string
	) {}
}
