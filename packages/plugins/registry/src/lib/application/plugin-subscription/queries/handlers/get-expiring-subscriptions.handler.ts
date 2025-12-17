import { PluginSubscriptionStatus } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Between, In } from 'typeorm';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { GetExpiringSubscriptionsQuery } from '../get-expiring-subscriptions.query';

@QueryHandler(GetExpiringSubscriptionsQuery)
export class GetExpiringSubscriptionsQueryHandler implements IQueryHandler<GetExpiringSubscriptionsQuery> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(query: GetExpiringSubscriptionsQuery): Promise<IPluginSubscription[]> {
		const { days } = query;

		try {
			// Calculate date range for expiring subscriptions
			const today = new Date();
			const futureDate = new Date(today);
			futureDate.setDate(today.getDate() + days);

			// Set time to end of day for futureDate to include full day
			futureDate.setHours(23, 59, 59, 999);

			// Find subscriptions that expire within the specified number of days
			const expiringSubscriptions = await this.pluginSubscriptionService.find({
				where: {
					// Only active and trial subscriptions that have an end date
					status: In([
						PluginSubscriptionStatus.ACTIVE,
						PluginSubscriptionStatus.TRIAL,
						PluginSubscriptionStatus.PENDING
					]),
					endDate: Between(today, futureDate)
				},
				relations: ['plugin', 'plan', 'subscriber', 'pluginTenant'],
				order: {
					endDate: 'ASC'
				}
			});

			// Also find trial subscriptions that are expiring within the specified period
			const { items: expiringTrialSubscriptions } = await this.pluginSubscriptionService.findAll({
				where: {
					status: PluginSubscriptionStatus.TRIAL,
					trialEndDate: Between(today, futureDate)
				},
				relations: ['plugin', 'plan', 'subscriber', 'pluginTenant'],
				order: {
					trialEndDate: 'ASC'
				}
			});

			// Combine both results and remove duplicates based on subscription ID
			const allExpiringSubscriptions = [...(expiringSubscriptions || []), ...(expiringTrialSubscriptions || [])];
			const uniqueSubscriptions = allExpiringSubscriptions.filter(
				(subscription, index, self) => index === self.findIndex((s) => s.id === subscription.id)
			);

			// Sort by expiration date (earliest first)
			uniqueSubscriptions.sort((a, b) => {
				const aExpDate = a.endDate || a.trialEndDate;
				const bExpDate = b.endDate || b.trialEndDate;

				if (!aExpDate && !bExpDate) return 0;
				if (!aExpDate) return 1;
				if (!bExpDate) return -1;

				return aExpDate.getTime() - bExpDate.getTime();
			});

			return uniqueSubscriptions;
		} catch (error) {
			// Log error and return empty array instead of throwing
			console.error('Error finding expiring subscriptions:', error);
			return [];
		}
	}
}
