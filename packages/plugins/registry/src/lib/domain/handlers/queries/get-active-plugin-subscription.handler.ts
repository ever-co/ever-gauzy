import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { GetActivePluginSubscriptionQuery } from '../../queries';
import { PluginSubscriptionService } from '../../services';
import { IPluginSubscription } from '../../../shared/models';

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
