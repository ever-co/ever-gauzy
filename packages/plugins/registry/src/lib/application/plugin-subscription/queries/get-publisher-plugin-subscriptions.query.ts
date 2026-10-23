import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

/**
 * Every subscription to a plugin, in every tenant: the list its publisher manages their subscribers from. Only for
 * the plugin's publisher (`PluginOwnerGuard` on the route).
 */
export class GetPublisherPluginSubscriptionsQuery implements IQuery {
	public static readonly type = '[Plugin Subscription] Get For Publisher';

	/**
	 * @param pluginId - The publisher's plugin.
	 */
	constructor(public readonly pluginId: ID) {}
}
