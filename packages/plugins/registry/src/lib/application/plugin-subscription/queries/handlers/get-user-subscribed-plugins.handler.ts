import { IPagination, PluginInstallationStatus, PluginSubscriptionStatus } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginInstallationService, PluginService, PluginSubscriptionService } from '../../../../domain';
import { IPlugin } from '../../../../shared';
import { GetUserSubscribedPluginsQuery } from '../get-user-subscribed-plugins.query';

@QueryHandler(GetUserSubscribedPluginsQuery)
export class GetUserSubscribedPluginsQueryHandler implements IQueryHandler<GetUserSubscribedPluginsQuery> {
	constructor(
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginInstallationService: PluginInstallationService,
		private readonly pluginService: PluginService
	) {}

	/**
	 * Execute the query to get all plugins where the user has a subscription
	 * Uses database-level subquery for efficient pagination
	 * Excludes plugins that already have a valid installation
	 * @param query - The query containing userId, tenantId, organizationId and options
	 * @returns Paginated list of plugins with active subscriptions (excluding installed ones)
	 */
	async execute(query: GetUserSubscribedPluginsQuery): Promise<IPagination<IPlugin>> {
		const { userId, tenantId, organizationId, options = {} } = query;
		const { status, skip = 0, take = 10, relations = [] } = options;

		try {
			// Build the default relations
			const defaultRelations = ['versions', 'category', 'tags'];
			const pluginRelations = [...new Set([...defaultRelations, ...relations])];

			// Determine statuses to filter
			const statuses = status ? [status] : [PluginSubscriptionStatus.ACTIVE, PluginSubscriptionStatus.TRIAL];

			// Build subquery to get plugin IDs from subscriptions
			const subQuery = this.pluginSubscriptionService
				.createQueryBuilder('subscription')
				.select('DISTINCT subscription.pluginId')
				.where('subscription.subscriberId = :userId', { userId })
				.andWhere('subscription.tenantId = :tenantId', { tenantId })
				.andWhere('subscription.status IN (:...statuses)', { statuses });

			// Add organization filter if provided
			if (organizationId) {
				subQuery.andWhere('subscription.organizationId = :organizationId', { organizationId });
			}

			// Build subquery to get plugin IDs that have valid installations
			const installedPluginsSubQuery = this.pluginInstallationService
				.createQueryBuilder('installation')
				.select('DISTINCT installation.pluginId')
				.where('installation.tenantId = :tenantId', { tenantId })
				.andWhere('installation.status = :installedStatus', {
					installedStatus: PluginInstallationStatus.INSTALLED
				});

			// Add organization filter for installations if provided
			if (organizationId) {
				installedPluginsSubQuery.andWhere('installation.organizationId = :organizationId', { organizationId });
			}

			// Build the main query for plugins using subquery
			const pluginRepository = this.pluginService.typeOrmPluginRepository;
			const queryBuilder = pluginRepository
				.createQueryBuilder('plugin')
				.where(`plugin.id IN (${subQuery.getQuery()})`)
				.andWhere(`plugin.id NOT IN (${installedPluginsSubQuery.getQuery()})`)
				.setParameters({
					...subQuery.getParameters(),
					...installedPluginsSubQuery.getParameters()
				})
				.orderBy('plugin.name', 'ASC')
				.skip(skip)
				.take(take);

			// Add relations
			pluginRelations.forEach((relation) => {
				queryBuilder.leftJoinAndSelect(`plugin.${relation}`, relation);
			});

			// Execute query with count at database level
			const [items, total] = await queryBuilder.getManyAndCount();

			return { items: items as IPlugin[], total };
		} catch (error) {
			console.error(`Error finding subscribed plugins for user ${userId}:`, error);
			return { items: [], total: 0 };
		}
	}
}
