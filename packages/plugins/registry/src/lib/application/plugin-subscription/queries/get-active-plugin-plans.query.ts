import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';
import { PluginSubscriptionType } from '../../../shared';

export class GetActivePluginPlansQuery implements IQuery {
	public static readonly type = '[Plugin Subscription Plan] Get Active Plans';

	constructor(
		public readonly pluginId?: ID,
		public readonly type?: PluginSubscriptionType,
		public readonly relations: string[] = []
	) {}
}
