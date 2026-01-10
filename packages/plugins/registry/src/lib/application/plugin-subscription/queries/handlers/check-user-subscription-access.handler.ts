import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionAccessService } from '../../../../domain';
import { PluginSubscriptionAccessResponseDTO } from '../../../../shared';
import { CheckUserSubscriptionAccessQuery } from '../check-user-subscription-access.query';

@QueryHandler(CheckUserSubscriptionAccessQuery)
export class CheckUserSubscriptionAccessQueryHandler implements IQueryHandler<CheckUserSubscriptionAccessQuery> {
	constructor(private readonly subscriptionAccessService: PluginSubscriptionAccessService) {}

	/**
	 * Execute user-specific subscription access check query
	 * Validates if a specific user has access to the plugin
	 */
	async execute(query: CheckUserSubscriptionAccessQuery): Promise<PluginSubscriptionAccessResponseDTO> {
		const { pluginId, userId, tenantId, organizationId } = query;

		try {
			const details = await this.subscriptionAccessService.getSubscriptionDetails(
				pluginId,
				tenantId,
				organizationId,
				userId
			);

			return {
				hasAccess: details.hasAccess,
				accessLevel: details.accessLevel,
				canAssign: details.canAssign,
				requiresSubscription: details.requiresSubscription,
				subscription: details.subscription,
				canActivate: details.canActivate
			};
		} catch (error) {
			throw new BadRequestException(`Failed to check user subscription access: ${error.message}`);
		}
	}
}
