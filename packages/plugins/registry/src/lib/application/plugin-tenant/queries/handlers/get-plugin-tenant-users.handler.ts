import { IUser } from '@gauzy/contracts';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginTenantService } from '../../../../domain';
import { GetPluginTenantUsersQuery } from '../get-plugin-tenant-users.query';

/**
 * Extended user with assignment info
 */
export interface PluginTenantUser extends Partial<IUser> {
	id: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	imageUrl?: string;
	accessType: 'allowed' | 'denied';
	assignedAt?: Date;
}

/**
 * Response for plugin tenant users query
 */
export interface GetPluginTenantUsersResult {
	items: PluginTenantUser[];
	total: number;
}

@QueryHandler(GetPluginTenantUsersQuery)
@Injectable()
export class GetPluginTenantUsersHandler implements IQueryHandler<GetPluginTenantUsersQuery> {
	private readonly logger = new Logger(GetPluginTenantUsersHandler.name);

	constructor(private readonly pluginTenantService: PluginTenantService) {}

	/**
	 * Executes the get plugin tenant users query
	 *
	 * @param query - The query containing filter parameters
	 * @returns Paginated list of users with their access type
	 * @throws NotFoundException if plugin tenant not found
	 */
	public async execute(query: GetPluginTenantUsersQuery): Promise<GetPluginTenantUsersResult> {
		const { pluginTenantId, userType, skip = 0, take = 20, searchTerm } = query;

		this.logger.log(`Getting ${userType} users for plugin tenant ${pluginTenantId}`);

		// Get plugin tenant with user relations
		const pluginTenant = await this.pluginTenantService.findOneByIdString(pluginTenantId, {
			relations: ['allowedUsers', 'deniedUsers']
		});

		if (!pluginTenant) {
			throw new NotFoundException(`Plugin tenant with ID "${pluginTenantId}" not found`);
		}

		// Map users based on type
		let users: PluginTenantUser[] = [];

		if (userType === 'allowed' || userType === 'all') {
			const allowedUsers = (pluginTenant.allowedUsers || []).map((user) =>
				this.mapUserToPluginTenantUser(user, 'allowed')
			);
			users = [...users, ...allowedUsers];
		}

		if (userType === 'denied' || userType === 'all') {
			const deniedUsers = (pluginTenant.deniedUsers || []).map((user) =>
				this.mapUserToPluginTenantUser(user, 'denied')
			);
			users = [...users, ...deniedUsers];
		}

		// Apply search filter if provided
		if (searchTerm) {
			const lowerSearchTerm = searchTerm.toLowerCase();
			users = users.filter(
				(user) =>
					user.firstName?.toLowerCase().includes(lowerSearchTerm) ||
					user.lastName?.toLowerCase().includes(lowerSearchTerm) ||
					user.email?.toLowerCase().includes(lowerSearchTerm)
			);
		}

		// Calculate total before pagination
		const total = users.length;

		// Apply pagination
		const paginatedUsers = users.slice(skip, skip + take);

		this.logger.log(`Found ${total} users, returning ${paginatedUsers.length} after pagination`);

		return {
			items: paginatedUsers,
			total
		};
	}

	/**
	 * Map user entity to PluginTenantUser with access type
	 */
	private mapUserToPluginTenantUser(user: IUser, accessType: 'allowed' | 'denied'): PluginTenantUser {
		return {
			id: user.id,
			firstName: user.firstName,
			lastName: user.lastName,
			email: user.email,
			imageUrl: user.imageUrl,
			accessType,
			assignedAt: new Date() // We don't track this in the pivot table, so use current date
		};
	}
}
