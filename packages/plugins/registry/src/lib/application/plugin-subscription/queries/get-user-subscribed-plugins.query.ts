import { ID, PluginSubscriptionStatus } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

/**
 * Query options for retrieving user's subscribed plugins
 */
export interface GetUserSubscribedPluginsOptions {
	/** Filter by subscription status */
	status?: Array<PluginSubscriptionStatus>;
	/** Number of items to skip for pagination */
	skip?: number;
	/** Number of items to take for pagination */
	take?: number;
	/** Relations to include in plugin results */
	relations?: string[];
}

/**
 * Query to retrieve all plugins where a user has an active subscription
 */
export class GetUserSubscribedPluginsQuery implements IQuery {
	public static readonly type = '[Plugin] Get User Subscribed Plugins';

	constructor(
		public readonly userId: ID,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly options?: GetUserSubscribedPluginsOptions
	) {}
}
