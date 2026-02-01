import { IPagination } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { In } from 'typeorm';
import { PluginService } from '../../../../domain';
import { IPlugin } from '../../../../shared';
import { GetUserSubscribedPluginsQuery } from '../get-user-subscribed-plugins.query';

@QueryHandler(GetUserSubscribedPluginsQuery)
export class GetUserSubscribedPluginsQueryHandler implements IQueryHandler<GetUserSubscribedPluginsQuery> {
	constructor(private readonly pluginService: PluginService) {}

	/**
	 * Execute the query to get all plugins where the user has a subscription
	 * Uses database-level subquery for efficient pagination
	 * Excludes plugins that already have a valid installation
	 * @param query - The query containing userId, tenantId, organizationId and options
	 * @returns Paginated list of plugins with active subscriptions (excluding installed ones)
	 */
	async execute(query: GetUserSubscribedPluginsQuery): Promise<IPagination<IPlugin>> {
		const { userId: subscriberId, tenantId, organizationId, options = {} } = query;
		const { status = [], skip = 0, take = 10 } = options;

		try {
			return this.pluginService.findAll({
				where: {
					subscriptions: {
						tenantId,
						subscriberId,
						organizationId,
						pluginTenant: {
							enabled: true
						},
						...(status.length > 0 && { status: In([...status]) })
					}
				},
				select: {
					id: true,
					name: true,
					description: true,
					type: true,
					status: true,
					versions: {
						id: true,
						number: true,
						sources: true
					},
					subscriptions: {
						id: true,
						status: true,
						pluginTenant: {
							id: true,
							enabled: true,
							isMandatory: true,
							autoInstall: true
						}
					}
				},
				relations: ['versions', 'subscriptions', 'subscriptions.pluginTenant'],
				skip,
				take
			});
		} catch (error) {
			console.error(`Error finding subscribed plugins for user ${subscriberId}:`, error);
			return { items: [], total: 0 };
		}
	}
}
