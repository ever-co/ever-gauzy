import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { GetPluginSubscriptionsBySubscriberIdQuery } from '../get-plugin-subscriptions-by-subscriber-id.query';

@QueryHandler(GetPluginSubscriptionsBySubscriberIdQuery)
export class GetPluginSubscriptionsBySubscriberIdQueryHandler
	implements IQueryHandler<GetPluginSubscriptionsBySubscriberIdQuery>
{
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(query: GetPluginSubscriptionsBySubscriberIdQuery): Promise<IPluginSubscription[]> {
		const { subscriberId, relations } = query;

		try {
			return this.pluginSubscriptionService.findBySubscriberId(
				subscriberId,
				relations || ['plugin', 'tenant', 'subscriber']
			);
		} catch (error) {
			throw new BadRequestException(`Failed to get plugin subscriptions by subscriber ID: ${error.message}`);
		}
	}
}
