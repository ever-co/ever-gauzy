import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionAccessService } from '../../../../domain/services/plugin-subscription-access.service';
import { PluginSubscriptionService } from '../../../../domain/services/plugin-subscription.service';
import { PluginTenantService } from '../../../../domain/services/plugin-tenant.service';
import { PluginUserAssignmentService, UserAssignmentRecord } from '../../../../domain/services/plugin-user-assignment.service';
import { RevokePluginSubscriptionUsersCommand } from '../../commands/revoke-plugin-subscription-users.command';

@CommandHandler(RevokePluginSubscriptionUsersCommand)
export class RevokePluginSubscriptionUsersCommandHandler
	implements ICommandHandler<RevokePluginSubscriptionUsersCommand>
{
	constructor(
		private readonly subscriptionAccessService: PluginSubscriptionAccessService,
		private readonly subscriptionService: PluginSubscriptionService,
		private readonly userAssignmentService: PluginUserAssignmentService,
		private readonly pluginTenantService: PluginTenantService
	) {}

	/**
	 * Execute revocation of users from plugin subscription
	 *
	 * Process:
	 * 1. Validate revocation permission
	 * 2. Find parent subscription
	 * 3. Find PluginTenant for tracking
	 * 4. Revoke child subscriptions (set status to CANCELLED)
	 * 5. Remove user assignments from PluginTenant
	 */
	async execute(command: RevokePluginSubscriptionUsersCommand): Promise<{ message: string; revokedUsers: number }> {
		const { pluginId, revokeDto, tenantId, organizationId, requestingUserId } = command;

		try {
			// Validate that the requesting user has permission to revoke subscriptions
			await this.subscriptionAccessService.requireAssignmentPermission(
				pluginId,
				tenantId,
				organizationId,
				requestingUserId
			);

			// Find the parent subscription
			const parentSubscription = await this.subscriptionAccessService.findApplicableSubscription(
				pluginId,
				tenantId,
				organizationId
			);

			if (!parentSubscription) {
				throw new ForbiddenException('No valid parent subscription found for revocation');
			}

			// Find the PluginTenant for this plugin
			const pluginTenant = await this.pluginTenantService.findByPluginAndTenant(
				pluginId,
				tenantId,
				organizationId
			);

			if (!pluginTenant) {
				throw new NotFoundException('Plugin tenant configuration not found');
			}

			// Revoke child subscriptions for the users
			const revokedSubscriptions = await this.subscriptionService.revokeChildSubscriptions(
				parentSubscription.id,
				revokeDto.userIds
			);

			// Revoke users from the plugin using the PluginTenant ID
			const revocations: UserAssignmentRecord[] = await this.userAssignmentService.unassignUsersFromPlugin(
				pluginTenant.id,
				revokeDto.userIds,
				revokeDto.revocationReason
			);

			return {
				message: `Successfully revoked access for ${revocations.length} user(s) and cancelled ${revokedSubscriptions.length} child subscription(s)`,
				revokedUsers: revocations.length
			};
		} catch (error) {
			if (error instanceof ForbiddenException || error instanceof BadRequestException || error instanceof NotFoundException) {
				throw error;
			}
			throw new BadRequestException(`Failed to revoke users from plugin subscription: ${error.message}`);
		}
	}
}
