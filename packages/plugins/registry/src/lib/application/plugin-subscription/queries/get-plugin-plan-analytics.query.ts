import { IQuery } from '@nestjs/cqrs';
import { PluginPlanAnalyticsDTO } from '../../../shared';

export class GetPluginPlanAnalyticsQuery implements IQuery {
	public static readonly type = '[Plugin Subscription Plan] Get Analytics';

	constructor(public readonly analyticsDto: PluginPlanAnalyticsDTO) {}
}
