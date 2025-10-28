import { IQuery } from '@nestjs/cqrs';
import { PluginSubscriptionPlanQueryDTO } from '../../shared/dto/plugin-subscription-plan.dto';

export class ListPluginSubscriptionPlansQuery implements IQuery {
	public static readonly type = '[Plugin Subscription Plan] List';

	constructor(public readonly queryDto: PluginSubscriptionPlanQueryDTO, public readonly relations: string[] = []) {}
}
