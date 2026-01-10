import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionAccessService } from '../../../../domain';
import { PluginSubscriptionAccessResponseDTO } from '../../../../shared';
import { GetSubscriptionAccessQuery } from '../get-subscription-access.query';

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
			return this.subscriptionAccessService.getSubscriptionDetails(pluginId, tenantId, organizationId, userId);
		} catch (error) {
			throw new BadRequestException(`Failed to get subscription access: ${error.message}`);
		}
	}
}
