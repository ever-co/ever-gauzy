import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class GetPluginSubscriptionPlansByPluginIdQuery implements IQuery {
	public static readonly type = '[Plugin Subscription Plan] Get By Plugin ID';

	constructor(public readonly pluginId: ID, public readonly relations: string[] = []) {}
}
