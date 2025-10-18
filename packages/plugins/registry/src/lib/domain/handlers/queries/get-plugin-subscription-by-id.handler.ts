import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { GetPluginSubscriptionByIdQuery } from '../../queries';
import { PluginSubscriptionService } from '../../services';
import { IPluginSubscription } from '../../../shared/models';

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
