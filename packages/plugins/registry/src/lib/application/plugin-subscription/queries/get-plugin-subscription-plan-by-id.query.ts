import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class GetPluginSubscriptionPlanByIdQuery implements IQuery {
	public static readonly type = '[Plugin Subscription Plan] Get By ID';

	constructor(public readonly id: ID, public readonly relations: string[] = []) {}
}
