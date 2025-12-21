import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionPlanService } from '../../../../domain';
import { IPluginSubscriptionPlan } from '../../../../shared';
import { GetPluginSubscriptionPlansByPluginIdQuery } from '../get-plugin-subscription-plans-by-plugin-id.query';

@QueryHandler(GetPluginSubscriptionPlansByPluginIdQuery)
export class GetPluginSubscriptionPlansByPluginIdQueryHandler
	implements IQueryHandler<GetPluginSubscriptionPlansByPluginIdQuery>
{
	constructor(private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService) {}

	async execute(query: GetPluginSubscriptionPlansByPluginIdQuery): Promise<IPluginSubscriptionPlan[]> {
		const { pluginId, relations } = query;

		try {
			return await this.pluginSubscriptionPlanService.getByPluginId(pluginId, relations);
		} catch (error) {
			throw new BadRequestException(`Failed to get plugin subscription plans: ${error.message}`);
		}
	}
}
