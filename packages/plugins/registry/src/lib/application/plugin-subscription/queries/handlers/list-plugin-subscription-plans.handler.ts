import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionPlanService } from '../../../../domain';
import { IPluginSubscriptionPlan } from '../../../../shared';
import { ListPluginSubscriptionPlansQuery } from '../list-plugin-subscription-plans.query';

@QueryHandler(ListPluginSubscriptionPlansQuery)
export class ListPluginSubscriptionPlansQueryHandler implements IQueryHandler<ListPluginSubscriptionPlansQuery> {
	constructor(private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService) {}

	async execute(query: ListPluginSubscriptionPlansQuery): Promise<IPluginSubscriptionPlan[]> {
		const { queryDto } = query;

		try {
			// Convert DTO to find input format
			const findInput = {
				pluginId: queryDto.pluginId,
				type: queryDto.type,
				billingPeriod: queryDto.billingPeriod,
				isActive: queryDto.isActive,
				isPopular: queryDto.isPopular,
				isRecommended: queryDto.isRecommended
			};

			return await this.pluginSubscriptionPlanService.searchPlans(findInput);
		} catch (error) {
			throw new BadRequestException(`Failed to list plugin subscription plans: ${error.message}`);
		}
	}
}
