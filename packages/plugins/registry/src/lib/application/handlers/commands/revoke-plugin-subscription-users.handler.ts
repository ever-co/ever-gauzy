import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginInstallationService } from '../../../domain/services/plugin-installation.service';
import { PluginSubscriptionAccessService } from '../../../domain/services/plugin-subscription-access.service';
import { PluginSubscriptionService } from '../../../domain/services/plugin-subscription.service';
import { PluginUserAssignmentService } from '../../../domain/services/plugin-user-assignment.service';
import { PluginInstallationStatus } from '../../../shared/models/plugin-installation.model';
import { RevokePluginSubscriptionUsersCommand } from '../../commands/revoke-plugin-subscription-users.command';

@CommandHandler(RevokePluginSubscriptionUsersCommand)
export class RevokePluginSubscriptionUsersCommandHandler
	implements ICommandHandler<RevokePluginSubscriptionUsersCommand>
{
	constructor(
		private readonly subscriptionAccessService: PluginSubscriptionAccessService,
		private readonly subscriptionService: PluginSubscriptionService,
		private readonly userAssignmentService: PluginUserAssignmentService,
		private readonly pluginInstallationService: PluginInstallationService
	) {}

	/**
	 * Execute revocation of users from plugin subscription
	 *
	 * Process:
	 * 1. Validate revocation permission
	 * 2. Find parent subscription
	 * 3. Revoke child subscriptions (set status to CANCELLED)
	 * 4. Remove user assignments
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

			// Revoke child subscriptions for the users
			const revokedSubscriptions = await this.subscriptionService.revokeChildSubscriptions(
				parentSubscription.id,
				revokeDto.userIds
			);

			// Find the plugin installation
			const pluginInstallation = await this.pluginInstallationService.findOneByWhereOptions({
				pluginId,
				tenantId,
				organizationId,
				status: PluginInstallationStatus.INSTALLED
			});

			if (!pluginInstallation) {
				throw new BadRequestException('Plugin installation not found');
			}

			// Revoke users from the plugin
			const revocations = await this.userAssignmentService.unassignUsersFromPlugin(
				pluginInstallation.id,
				revokeDto.userIds,
				revokeDto.revocationReason
			);

			return {
				message: `Successfully revoked access for ${revocations.length} user(s) and cancelled ${revokedSubscriptions.length} child subscription(s)`,
				revokedUsers: revocations.length
			};
		} catch (error) {
			if (error instanceof ForbiddenException || error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to revoke users from plugin subscription: ${error.message}`);
		}
	}
}
