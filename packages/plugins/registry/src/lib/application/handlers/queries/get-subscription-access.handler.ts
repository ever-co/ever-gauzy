import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionAccessService } from '../../../domain/services/plugin-subscription-access.service';
import { PluginSubscriptionAccessResponseDTO } from '../../../shared/dto/plugin-subscription-assignment.dto';
import { GetSubscriptionAccessQuery } from '../../queries/get-subscription-access.query';

@QueryHandler(GetSubscriptionAccessQuery)
export class GetSubscriptionAccessQueryHandler implements IQueryHandler<GetSubscriptionAccessQuery> {
	constructor(private readonly subscriptionAccessService: PluginSubscriptionAccessService) {}

	/**
	 * Execute subscription access check query
	 * Returns detailed access information including permission to assign
	 */
	async execute(query: GetSubscriptionAccessQuery): Promise<PluginSubscriptionAccessResponseDTO> {
		const { pluginId, tenantId, organizationId, userId } = query;

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
				subscription: details.subscription
			};
		} catch (error) {
			throw new BadRequestException(`Failed to get subscription access: ${error.message}`);
		}
	}
}
