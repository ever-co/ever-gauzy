import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionPlanService } from '../../../../domain';
import { IPluginSubscriptionPlan } from '../../../../shared';
import { GetActivePluginPlansQuery } from '../get-active-plugin-plans.query';

@QueryHandler(GetActivePluginPlansQuery)
export class GetActivePluginPlansQueryHandler implements IQueryHandler<GetActivePluginPlansQuery> {
	constructor(private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService) {}

	async execute(query: GetActivePluginPlansQuery): Promise<IPluginSubscriptionPlan[]> {
		const { pluginId, type, relations } = query;

		try {
			return await this.pluginSubscriptionPlanService.getActivePlans(pluginId, type, relations);
		} catch (error) {
			throw new BadRequestException(`Failed to get active plugin plans: ${error.message}`);
		}
	}
}
