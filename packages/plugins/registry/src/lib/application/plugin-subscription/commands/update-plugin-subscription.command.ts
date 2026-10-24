import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { UpdatePluginSubscriptionDTO } from '../../../shared';

export class UpdatePluginSubscriptionCommand implements ICommand {
	public static readonly type = '[Plugin Subscription] Update';

	/**
	 * @param id - The subscription to update.
	 * @param updateDto - The fields to change; only those the caller may write are kept.
	 * @param pluginId - The plugin the route names; a subscription of another plugin is not found.
	 */
	constructor(
		public readonly id: ID,
		public readonly updateDto: UpdatePluginSubscriptionDTO,
		public readonly pluginId?: ID
	) {}
}
