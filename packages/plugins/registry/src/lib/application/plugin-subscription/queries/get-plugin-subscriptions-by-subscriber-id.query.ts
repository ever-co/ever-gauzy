import { IQuery } from '@nestjs/cqrs';

export class GetPluginSubscriptionsBySubscriberIdQuery implements IQuery {
	public static readonly type = '[Plugin Subscription] Get By Subscriber ID';

	constructor(public readonly subscriberId: string, public readonly relations?: string[]) {}
}
