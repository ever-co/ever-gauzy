import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { GetPluginSubscriptionByIdQuery } from '../get-plugin-subscription-by-id.query';

@QueryHandler(GetPluginSubscriptionByIdQuery)
export class GetPluginSubscriptionByIdQueryHandler implements IQueryHandler<GetPluginSubscriptionByIdQuery> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(query: GetPluginSubscriptionByIdQuery): Promise<IPluginSubscription> {
		const { id, relations } = query;

		try {
			const subscription = await this.pluginSubscriptionService.findOneByIdString(id, {
				relations: relations || ['plugin', 'pluginTenant', 'subscriber']
			});

			if (!subscription) {
				throw new NotFoundException(`Plugin subscription with ID ${id} not found`);
			}

			return subscription;
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			throw new NotFoundException(`Failed to get plugin subscription: ${error.message}`);
		}
	}
}
