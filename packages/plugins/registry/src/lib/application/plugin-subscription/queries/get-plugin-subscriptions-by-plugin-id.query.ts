import { IQuery } from '@nestjs/cqrs';

export class GetPluginSubscriptionsByPluginIdQuery implements IQuery {
	public static readonly type = '[Plugin Subscription] Get By Plugin ID';

	constructor(public readonly pluginId: string, public readonly relations?: string[]) {}
}
