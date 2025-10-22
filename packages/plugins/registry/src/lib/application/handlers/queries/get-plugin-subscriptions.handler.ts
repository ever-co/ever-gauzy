import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { GetPluginSubscriptionsQuery } from '../../queries';
import { PluginSubscriptionService } from '../../../domain/services';
import { PluginSubscription } from '../../entities';
import { IPagination } from '@gauzy/contracts';

@QueryHandler(GetPluginSubscriptionsQuery)
export class GetPluginSubscriptionsQueryHandler implements IQueryHandler<GetPluginSubscriptionsQuery> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(query: GetPluginSubscriptionsQuery): Promise<IPagination<PluginSubscription>> {
		const { query: subscriptionQuery } = query;

		try {
			return this.pluginSubscriptionService.findAll({
				where: subscriptionQuery,
				relations: ['plugin', 'tenant', 'subscriber', 'pluginTenant'],
				order: { createdAt: 'DESC' }
			});
		} catch (error) {
			throw new BadRequestException(`Failed to get plugin subscriptions: ${error.message}`);
		}
	}
}
