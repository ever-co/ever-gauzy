import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindOptionsWhere, In } from 'typeorm';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription, PluginSubscriptionStatus } from '../../../../shared';
import { GetActivePluginSubscriptionQuery } from '../get-active-plugin-subscription.query';

@QueryHandler(GetActivePluginSubscriptionQuery)
export class GetActivePluginSubscriptionQueryHandler implements IQueryHandler<GetActivePluginSubscriptionQuery> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(query: GetActivePluginSubscriptionQuery): Promise<IPluginSubscription | null> {
		const { pluginId, tenantId, organizationId, subscriberId } = query;

		try {
			// Build where conditions for finding active subscription
			const whereConditions: FindOptionsWhere<IPluginSubscription> = {
				pluginId,
				tenantId,
				status: In([PluginSubscriptionStatus.ACTIVE, PluginSubscriptionStatus.TRIAL])
			};

			// Add optional conditions
			if (organizationId) {
				whereConditions.organizationId = organizationId;
			}

			if (subscriberId) {
				whereConditions.subscriberId = subscriberId;
			}

			// Find the most recent active subscription that matches criteria
			const subscription = await this.pluginSubscriptionService.findOneByOptions({
				where: whereConditions,
				order: { createdAt: 'DESC' },
				relations: ['plugin', 'plan', 'subscriber', 'parent']
			});

			// Additional validation: check if subscription is not expired
			if (subscription?.endDate && subscription.endDate <= new Date()) {
				return null;
			}

			return subscription;
		} catch (error) {
			// If no subscription is found or any error occurs, return null
			return null;
		}
	}
}
