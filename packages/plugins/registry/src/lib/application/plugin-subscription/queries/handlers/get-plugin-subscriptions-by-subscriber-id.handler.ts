import { IPagination } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { GetPluginSubscriptionsBySubscriberIdQuery } from '../get-plugin-subscriptions-by-subscriber-id.query';

@QueryHandler(GetPluginSubscriptionsBySubscriberIdQuery)
export class GetPluginSubscriptionsBySubscriberIdQueryHandler
	implements IQueryHandler<GetPluginSubscriptionsBySubscriberIdQuery>
{
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(query: GetPluginSubscriptionsBySubscriberIdQuery): Promise<IPagination<IPluginSubscription>> {
		const { subscriberId, relations } = query;

		try {
			// Build where condition for finding subscriptions by subscriber ID
			const whereCondition = {
				subscriberId
			};

			// Find all subscriptions for the specified subscriber
			return this.pluginSubscriptionService.findAll({
				where: whereCondition,
				relations: relations || ['plugin', 'plan', 'subscriber', 'pluginTenant'],
				order: {
					createdAt: 'DESC'
				}
			});
		} catch (error) {
			// Log error and return empty array instead of throwing
			console.error(`Error finding plugin subscriptions by subscriber ID ${subscriberId}:`, error);
			return { items: [], total: 0 };
		}
	}
}
