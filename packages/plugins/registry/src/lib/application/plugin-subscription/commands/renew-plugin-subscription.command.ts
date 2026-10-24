import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class RenewPluginSubscriptionCommand implements ICommand {
	public static readonly type = '[Plugin Subscription] Renew';

	/**
	 * @param id - The subscription to renew.
	 * @param pluginId - The plugin the route names; a subscription of another plugin is not found.
	 */
	constructor(
		public readonly id: ID,
		public readonly pluginId?: ID
	) {}
}
