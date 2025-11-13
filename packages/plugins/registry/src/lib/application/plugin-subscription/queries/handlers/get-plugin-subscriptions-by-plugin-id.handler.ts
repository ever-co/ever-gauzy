import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { GetPluginSubscriptionsByPluginIdQuery } from '../get-plugin-subscriptions-by-plugin-id.query';

@QueryHandler(GetPluginSubscriptionsByPluginIdQuery)
export class GetPluginSubscriptionsByPluginIdQueryHandler
	implements IQueryHandler<GetPluginSubscriptionsByPluginIdQuery>
{
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(query: GetPluginSubscriptionsByPluginIdQuery): Promise<IPluginSubscription[]> {
		const { pluginId, relations } = query;

		try {
			return this.pluginSubscriptionService.findByPluginId(
				pluginId,
				relations || ['plugin', 'tenant', 'subscriber']
			);
		} catch (error) {
			throw new BadRequestException(`Failed to get plugin subscriptions by plugin ID: ${error.message}`);
		}
	}
}
