import { IQuery } from '@nestjs/cqrs';
import { PluginSubscriptionQueryDTO } from '../../../shared';

export class GetPluginSubscriptionsQuery implements IQuery {
	public static readonly type = '[Plugin Subscription] Get All';

	constructor(public readonly query: PluginSubscriptionQueryDTO) {}
}
