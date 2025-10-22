import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { GetExpiringSubscriptionsQuery } from '../../queries';
import { PluginSubscriptionService } from '../../../domain/services';
import { IPluginSubscription } from '../../../shared/models';

@QueryHandler(GetExpiringSubscriptionsQuery)
export class GetExpiringSubscriptionsQueryHandler implements IQueryHandler<GetExpiringSubscriptionsQuery> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(query: GetExpiringSubscriptionsQuery): Promise<IPluginSubscription[]> {
		const { days } = query;

		try {
			return await this.pluginSubscriptionService.getExpiringSubscriptions(days);
		} catch (error) {
			throw new BadRequestException(`Failed to get expiring subscriptions: ${error.message}`);
		}
	}
}
