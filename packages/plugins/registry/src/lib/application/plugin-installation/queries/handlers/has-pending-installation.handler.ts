import { PluginSubscriptionStatus } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { HasPendingInstallationQuery } from '../has-pending-installation.query';

@QueryHandler(HasPendingInstallationQuery)
export class HasPendingInstallationQueryHandler implements IQueryHandler<HasPendingInstallationQuery> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	/**
	 * Execute the query to check if user has at least one pending installation
	 * A pending installation means:
	 * 1. User has a valid subscription but has not installed the plugin yet, OR
	 * 2. User has a valid subscription and installation exists but is not activated (status !== INSTALLED)
	 * @param query - The query containing userId, tenantId, and optional organizationId
	 * @returns Boolean indicating whether there is at least one pending installation
	 */
	async execute(query: HasPendingInstallationQuery): Promise<boolean> {
		const { userId, tenantId, organizationId } = query;

		try {
			// Build subquery to get plugin IDs from active subscriptions
			const subscriptionSubQuery = this.pluginSubscriptionService
				.createQueryBuilder('subscription')
				.select('DISTINCT subscription.pluginId')
				.where('subscription.subscriberId = :userId', { userId })
				.andWhere('subscription.tenantId = :tenantId', { tenantId })
				.andWhere('subscription.status IN (:...statuses)', {
					statuses: [
						PluginSubscriptionStatus.ACTIVE,
						PluginSubscriptionStatus.TRIAL,
						PluginSubscriptionStatus.PENDING
					]
				});

			// Add organization filter if provided
			if (organizationId) {
				subscriptionSubQuery.andWhere('subscription.organizationId = :organizationId', { organizationId });
			}

			// Count subscribed plugins that are either:
			// 1. NOT installed at all, OR
			// 2. Installed but NOT activated (status !== INSTALLED)
			// This is achieved by checking subscribed plugins NOT IN activated plugins
			const subscriptionRepository = this.pluginSubscriptionService.typeOrmPluginSubscriptionRepository;
			const result = await subscriptionRepository
				.createQueryBuilder('sub')
				.select('COUNT(DISTINCT sub.pluginId)', 'count')
				.where(`sub.pluginId IN (${subscriptionSubQuery.getQuery()})`)
				.setParameters({
					...subscriptionSubQuery.getParameters()
				})
				.getRawOne();

			return parseInt(result?.count || '0', 10) > 0;
		} catch (error) {
			console.error(`Error checking pending installations for user ${userId}:`, error);
			return false;
		}
	}
}
