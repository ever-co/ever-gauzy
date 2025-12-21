import { RequestContext } from '@gauzy/core';
import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService, PluginTenantService } from '../../../../domain';
import { DeletePluginSubscriptionCommand } from '../delete-plugin-subscription.command';

@CommandHandler(DeletePluginSubscriptionCommand)
export class DeletePluginSubscriptionCommandHandler implements ICommandHandler<DeletePluginSubscriptionCommand> {
	constructor(
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginTenantService: PluginTenantService
	) {}

	async execute(command: DeletePluginSubscriptionCommand): Promise<void> {
		const { subscriptionId, pluginTenantId } = command;
		const userToRemoveId = RequestContext.currentUserId();

		try {
			// Remove the subscriber from the plugin tenant's allowed users.
			// Prefer the subscription's subscriberId; fall back to the current user.
			const tenant = await this.pluginTenantService.findOneByIdString(pluginTenantId);

			if (userToRemoveId) {
				// Remove the user from the allowed users of the tenant.
				tenant.removeAllowedUser(userToRemoveId);
				// Save the updated tenant.
				await this.pluginTenantService.save(tenant);
				// If the user to remove is the one who approved the tenant,
				if (tenant.approvedById === userToRemoveId) {
					await this.pluginTenantService.deletePluginTenant(pluginTenantId);
				}
			}
			// Ensure the subscription record is removed so duplicate subscriptions
			// (same pluginId, subscriberId, tenantId) can be created later.
			const subscription = await this.pluginSubscriptionService.findOneByIdString(subscriptionId);

			if (subscription) {
				await this.pluginSubscriptionService.delete(subscription.id);
			}
		} catch (error) {
			throw new BadRequestException(`Failed to delete plugin subscription: ${error.message}`);
		}
	}
}
