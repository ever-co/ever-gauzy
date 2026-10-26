import { IPagination } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { GetPublisherPluginSubscriptionsQuery } from '../get-publisher-plugin-subscriptions.query';

@QueryHandler(GetPublisherPluginSubscriptionsQuery)
export class GetPublisherPluginSubscriptionsQueryHandler implements IQueryHandler<GetPublisherPluginSubscriptionsQuery> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	/**
	 * Every subscription to the plugin, newest first, with its plan. The public plugin read no longer lists them
	 * (`public-plugin-subscriptions.ts`); this is where the publisher reads them.
	 */
	async execute(query: GetPublisherPluginSubscriptionsQuery): Promise<IPagination<IPluginSubscription>> {
		return this.pluginSubscriptionService.findAllOfPluginInAnyTenant(query.pluginId);
	}
}
