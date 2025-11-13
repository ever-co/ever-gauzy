import { IQuery } from '@nestjs/cqrs';

export class GetPluginSubscriptionByIdQuery implements IQuery {
	public static readonly type = '[Plugin Subscription] Get By ID';

	constructor(public readonly id: string, public readonly relations?: string[]) {}
}
