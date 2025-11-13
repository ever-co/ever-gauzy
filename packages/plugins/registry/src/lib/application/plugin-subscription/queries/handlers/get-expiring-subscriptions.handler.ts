import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { GetExpiringSubscriptionsQuery } from '../get-expiring-subscriptions.query';

@QueryHandler(GetExpiringSubscriptionsQuery)
export class GetExpiringSubscriptionsQueryHandler implements IQueryHandler<GetExpiringSubscriptionsQuery> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(query: GetExpiringSubscriptionsQuery): Promise<IPluginSubscription[]> {
		const { days } = query;

		try {
			return this.pluginSubscriptionService.getExpiringSubscriptions(days);
		} catch (error) {
			throw new BadRequestException(`Failed to get expiring subscriptions: ${error.message}`);
		}
	}
}
