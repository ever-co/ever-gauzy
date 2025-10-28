import { IQuery } from '@nestjs/cqrs';
import { PluginPlanAnalyticsDTO } from '../../shared/dto/plugin-subscription-plan.dto';

export class GetPluginPlanAnalyticsQuery implements IQuery {
	public static readonly type = '[Plugin Subscription Plan] Get Analytics';

	constructor(public readonly analyticsDto: PluginPlanAnalyticsDTO) {}
}
