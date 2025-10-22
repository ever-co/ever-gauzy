import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../domain/services';
import { IPluginSubscription } from '../../../shared/models';
import { GetActivePluginSubscriptionQuery } from '../../queries';

@QueryHandler(GetActivePluginSubscriptionQuery)
export class GetActivePluginSubscriptionQueryHandler implements IQueryHandler<GetActivePluginSubscriptionQuery> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(query: GetActivePluginSubscriptionQuery): Promise<IPluginSubscription | null> {
		const { pluginId, tenantId, organizationId, subscriberId } = query;

		try {
			return await this.pluginSubscriptionService.findActiveSubscription(
				pluginId,
				tenantId,
				organizationId,
				subscriberId
			);
		} catch (error) {
			throw new BadRequestException(`Failed to get active plugin subscription: ${error.message}`);
		}
	}
}
