import { IQuery } from '@nestjs/cqrs';

export class GetExpiringSubscriptionsQuery implements IQuery {
	public static readonly type = '[Plugin Subscription] Get Expiring';

	constructor(public readonly days: number = 7) {}
}
