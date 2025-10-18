import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { GetPluginSubscriptionsBySubscriberIdQuery } from '../../queries';
import { PluginSubscriptionService } from '../../services';
import { IPluginSubscription } from '../../../shared/models';

@QueryHandler(GetPluginSubscriptionsBySubscriberIdQuery)
export class GetPluginSubscriptionsBySubscriberIdQueryHandler
	implements IQueryHandler<GetPluginSubscriptionsBySubscriberIdQuery>
{
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(query: GetPluginSubscriptionsBySubscriberIdQuery): Promise<IPluginSubscription[]> {
		const { subscriberId, relations } = query;

		try {
			return await this.pluginSubscriptionService.findBySubscriberId(
				subscriberId,
				relations || ['plugin', 'tenant', 'subscriber']
			);
		} catch (error) {
			throw new BadRequestException(`Failed to get plugin subscriptions by subscriber ID: ${error.message}`);
		}
	}
}
