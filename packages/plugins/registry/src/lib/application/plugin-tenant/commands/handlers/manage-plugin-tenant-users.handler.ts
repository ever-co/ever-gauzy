import { ID, IUser } from '@gauzy/contracts';
import { RequestContext, UserService } from '@gauzy/core';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { In } from 'typeorm';
import { PluginSubscriptionAccessService, PluginSubscriptionService, PluginTenantService } from '../../../../domain';
import { IPluginTenant } from '../../../../shared';
import { ManagePluginTenantUsersCommand } from '../manage-plugin-tenant-users.command';

/**
 * Response for user management operations
 */
export interface ManagePluginTenantUsersResult {
	pluginTenant: IPluginTenant;
	affectedUserIds: string[];
	operation: string;
	message: string;
}

@CommandHandler(ManagePluginTenantUsersCommand)
@Injectable()
export class ManagePluginTenantUsersCommandHandler implements ICommandHandler<ManagePluginTenantUsersCommand> {
	private readonly logger = new Logger(ManagePluginTenantUsersCommandHandler.name);

	constructor(
		private readonly pluginTenantService: PluginTenantService,
		private readonly userService: UserService,
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginSubscriptionAccessService: PluginSubscriptionAccessService
	) {}

	/**
	 * Executes the manage plugin tenant users command
	 *
	 * @param command - The command containing user management data
	 * @returns The result of the operation with updated plugin tenant
	 * @throws BadRequestException if validation fails
	 * @throws NotFoundException if plugin tenant or users not found
	 */
	public async execute(command: ManagePluginTenantUsersCommand): Promise<ManagePluginTenantUsersResult> {
		const { pluginTenantId, userIds, operation } = command;

		this.logger.log(
			`Executing ${operation} operation for plugin tenant ${pluginTenantId} with ${
				userIds ? userIds.length : 0
			} users`
		);

		// Validate input
		if (!userIds || userIds.length === 0) {
			throw new BadRequestException('At least one user ID is required');
		}

		// Get plugin tenant with relations
		const pluginTenant = await this.pluginTenantService.findOneByIdString(pluginTenantId, {
			relations: ['allowedUsers', 'deniedUsers', 'plugin']
		});

		if (!pluginTenant) {
			throw new NotFoundException(`Plugin tenant with ID "${pluginTenantId}" not found`);
		}

		// Validate users exist
		const users = await this.validateAndGetUsers(userIds);

		// Initialize arrays if not present
		if (!pluginTenant.allowedUsers) {
			pluginTenant.allowedUsers = [];
		}
		if (!pluginTenant.deniedUsers) {
			pluginTenant.deniedUsers = [];
		}

		// Execute operation
		let message: string;
		const affectedUserIds: string[] = [];

		switch (operation) {
			case 'allow':
				for (const user of users) {
					pluginTenant.allowUser(user);
					affectedUserIds.push(user.id);
				}
				message = `Successfully allowed ${users.length} user(s) to access the plugin`;
				break;

			case 'deny':
				for (const user of users) {
					this.validate(user.id);
					pluginTenant.denyUser(user);
					affectedUserIds.push(user.id);
				}
				message = `Successfully denied ${users.length} user(s) from accessing the plugin`;
				break;

			case 'remove-allowed':
				for (const userId of userIds) {
					this.validate(userId);
					pluginTenant.removeAllowedUser(userId);
					affectedUserIds.push(userId);
				}
				message = `Successfully removed ${userIds.length} user(s) from allowed list`;
				break;

			case 'remove-denied':
				for (const userId of userIds) {
					this.validate(userId);
					pluginTenant.removeDeniedUser(userId);
					affectedUserIds.push(userId);
				}
				message = `Successfully removed ${userIds.length} user(s) from denied list`;
				break;

			default:
				throw new BadRequestException(`Unknown operation: ${operation}`);
		}

		// Save the updated plugin tenant first to persist allowed/denied users
		await this.pluginTenantService.save(pluginTenant);

		const organizationId = RequestContext.currentOrganizationId();
		const tenantId = RequestContext.currentTenantId();

		const subscription = await this.pluginSubscriptionAccessService.findApplicableSubscription(
			pluginTenant.pluginId,
			tenantId,
			organizationId
		);

		if (!subscription) {
			throw new NotFoundException(`Subscription for Plugin Tenant ID "${pluginTenantId}" not found`);
		}

		// After allowed users are saved, create child subscriptions from parent
		switch (operation) {
			case 'allow':
				await this.pluginSubscriptionService.createChildSubscriptions(
					subscription.id,
					affectedUserIds,
					tenantId,
					organizationId
				);
				break;
			case 'deny':
			case 'remove-allowed':
				await this.pluginSubscriptionService.revokeChildSubscriptions(subscription.id, affectedUserIds);
				break;
		}

		// Fetch with full relations
		const result = await this.pluginTenantService.findOneByIdString(pluginTenantId, {
			relations: ['plugin', 'allowedUsers', 'deniedUsers', 'allowedRoles']
		});

		this.logger.log(`${operation} operation completed: ${message}`);

		return {
			pluginTenant: result,
			affectedUserIds,
			operation,
			message
		};
	}

	/**
	 * Validate that all user IDs exist and return user entities
	 */
	private async validateAndGetUsers(userIds: string[]): Promise<IUser[]> {
		const users = await this.userService.find({
			where: { id: In(userIds) }
		});

		if (users.length !== userIds.length) {
			const foundIds = users.map((u) => u.id);
			const missingIds = userIds.filter((id) => !foundIds.includes(id));
			throw new NotFoundException(`Users not found: ${missingIds.join(', ')}`);
		}

		return users;
	}

	private async validate(userId: ID): Promise<void> {
		const currentUserId = RequestContext.currentUserId();

		if (userId === currentUserId) {
			throw new BadRequestException('Operation cannot be performed on the current user.');
		}
	}
}
