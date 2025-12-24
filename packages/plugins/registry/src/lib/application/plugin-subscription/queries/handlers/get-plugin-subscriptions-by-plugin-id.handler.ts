import { IPagination } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { GetPluginSubscriptionsByPluginIdQuery } from '../get-plugin-subscriptions-by-plugin-id.query';

@QueryHandler(GetPluginSubscriptionsByPluginIdQuery)
export class GetPluginSubscriptionsByPluginIdQueryHandler
	implements IQueryHandler<GetPluginSubscriptionsByPluginIdQuery>
{
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(query: GetPluginSubscriptionsByPluginIdQuery): Promise<IPagination<IPluginSubscription>> {
		const { pluginId, relations } = query;

		try {
			// Build where condition for finding subscriptions by plugin ID
			const whereCondition = {
				pluginId
			};

			// Find all subscriptions for the specified plugin
			return this.pluginSubscriptionService.findAll({
				where: whereCondition,
				relations: relations || ['plugin', 'plan', 'subscriber', 'pluginTenant'],
				order: {
					createdAt: 'DESC'
				}
			});
		} catch (error) {
			// Log error and return empty array instead of throwing
			console.error(`Error finding plugin subscriptions by plugin ID ${pluginId}:`, error);
			return { items: [], total: 0 };
		}
	}
}
