import { ID } from '@gauzy/contracts';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginInstallationService } from '../../../../domain/services/plugin-installation.service';
import { PluginSubscriptionAccessService } from '../../../../domain/services/plugin-subscription-access.service';
import { PluginSubscriptionService } from '../../../../domain/services/plugin-subscription.service';
import { PluginUserAssignmentService } from '../../../../domain/services/plugin-user-assignment.service';
import { PluginInstallationStatus } from '../../../../shared/models/plugin-installation.model';
import { AssignPluginSubscriptionUsersCommand } from '../assign-plugin-subscription-users.command';

@CommandHandler(AssignPluginSubscriptionUsersCommand)
export class AssignPluginSubscriptionUsersCommandHandler
	implements ICommandHandler<AssignPluginSubscriptionUsersCommand>
{
	constructor(
		private readonly subscriptionAccessService: PluginSubscriptionAccessService,
		private readonly subscriptionService: PluginSubscriptionService,
		private readonly userAssignmentService: PluginUserAssignmentService,
		private readonly pluginInstallationService: PluginInstallationService
	) {}

	/**
	 * Execute assignment of users to plugin subscription
	 *
	 * Process:
	 * 1. Validate assignment permission
	 * 2. Find parent subscription (org/tenant level)
	 * 3. Create child USER-scoped subscriptions
	 * 4. Create user assignments
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
				organizationId,
				requestingUserId
			);

			if (!parentSubscription) {
				throw new ForbiddenException('No valid parent subscription found for assignment');
			}

			// Create child subscriptions for the assigned users
			// These are USER-scoped subscriptions linked to the parent subscription
			const childSubscriptions = await this.subscriptionService.createChildSubscriptions(
				parentSubscription.id,
				assignDto.userIds,
				tenantId,
				organizationId
			);

			// Find or create a plugin installation for assignment
			const pluginInstallation = await this.findOrCreatePluginInstallation(pluginId, tenantId, organizationId);

			// Assign users to the plugin
			const assignments = await this.userAssignmentService.assignUsersToPlugin(
				pluginInstallation.id,
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

	/**
	 * Find or create a plugin installation for assignment purposes
	 */
	private async findOrCreatePluginInstallation(pluginId: ID, tenantId: ID, organizationId?: ID): Promise<any> {
		// Try to find existing installation
		const existingInstallation = await this.pluginInstallationService.findOneByWhereOptions({
			pluginId,
			tenantId,
			organizationId,
			status: PluginInstallationStatus.INSTALLED
		});

		if (existingInstallation) {
			return existingInstallation;
		}

		// Create a new installation record for assignment tracking
		const installation = await this.pluginInstallationService.create({
			pluginId,
			tenantId,
			organizationId,
			status: PluginInstallationStatus.INSTALLED,
			installedAt: new Date()
		});

		return installation;
	}
}
