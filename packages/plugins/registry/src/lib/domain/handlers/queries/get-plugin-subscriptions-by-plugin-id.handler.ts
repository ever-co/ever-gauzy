import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { GetPluginSubscriptionsByPluginIdQuery } from '../../queries';
import { PluginSubscriptionService } from '../../services';
import { IPluginSubscription } from '../../../shared/models';

@QueryHandler(GetPluginSubscriptionsByPluginIdQuery)
export class GetPluginSubscriptionsByPluginIdQueryHandler
	implements IQueryHandler<GetPluginSubscriptionsByPluginIdQuery>
{
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(query: GetPluginSubscriptionsByPluginIdQuery): Promise<IPluginSubscription[]> {
		const { pluginId, relations } = query;

		try {
			return await this.pluginSubscriptionService.findByPluginId(
				pluginId,
				relations || ['plugin', 'tenant', 'subscriber']
			);
		} catch (error) {
			throw new BadRequestException(`Failed to get plugin subscriptions by plugin ID: ${error.message}`);
		}
	}
}
