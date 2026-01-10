import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionAccessService } from '../../../../domain/services/plugin-subscription-access.service';
import { PluginSubscriptionService } from '../../../../domain/services/plugin-subscription.service';
import { PluginTenantService } from '../../../../domain/services/plugin-tenant.service';
import {
	PluginUserAssignmentService,
	UserAssignmentRecord
} from '../../../../domain/services/plugin-user-assignment.service';
import { AssignPluginSubscriptionUsersCommand } from '../assign-plugin-subscription-users.command';

@CommandHandler(AssignPluginSubscriptionUsersCommand)
export class AssignPluginSubscriptionUsersCommandHandler
	implements ICommandHandler<AssignPluginSubscriptionUsersCommand>
{
	constructor(
		private readonly subscriptionAccessService: PluginSubscriptionAccessService,
		private readonly subscriptionService: PluginSubscriptionService,
		private readonly userAssignmentService: PluginUserAssignmentService,
		private readonly pluginTenantService: PluginTenantService
	) {}

	/**
	 * Execute assignment of users to plugin subscription
	 *
	 * Process:
	 * 1. Validate assignment permission
	 * 2. Find parent subscription (org/tenant level)
	 * 3. Find or create PluginTenant for tracking
	 * 4. Create child USER-scoped subscriptions
	 * 5. Create user assignments in PluginTenant
	 */
	async execute(command: AssignPluginSubscriptionUsersCommand): Promise<{ message: string; assignedUsers: number }> {
		const { pluginId, assignDto, tenantId, organizationId, requestingUserId } = command;

		try {
			// Validate that the requesting user has permission to assign subscriptions
			await this.subscriptionAccessService.requireAssignmentPermission(
				pluginId,
				tenantId,
				organizationId,
				requestingUserId
			);

			// Find the parent subscription (organization/tenant level)
			const parentSubscription = await this.subscriptionAccessService.findApplicableSubscription(
				pluginId,
				tenantId,
				organizationId
			);

			if (!parentSubscription) {
				throw new ForbiddenException('No valid parent subscription found for assignment');
			}

			// Find or create a PluginTenant for assignment tracking
			const pluginTenantId = await this.pluginTenantService.findOrCreate({
				pluginId,
				tenantId,
				organizationId
			});

			// Create child subscriptions for the assigned users
			// These are USER-scoped subscriptions linked to the parent subscription
			const childSubscriptions = await this.subscriptionService.createChildSubscriptions(
				parentSubscription.id,
				assignDto.userIds,
				tenantId,
				organizationId
			);

			// Assign users to the plugin using the PluginTenant ID
			const assignments: UserAssignmentRecord[] = await this.userAssignmentService.assignUsersToPlugin(
				pluginTenantId,
				assignDto.userIds,
				assignDto.reason
			);

			return {
				message: `Successfully assigned ${assignments.length} user(s) to the plugin with ${childSubscriptions.length} child subscription(s) created`,
				assignedUsers: assignments.length
			};
		} catch (error) {
			if (error instanceof ForbiddenException) {
				throw error;
			}
			throw new BadRequestException(`Failed to assign users to plugin subscription: ${error.message}`);
		}
	}
}
