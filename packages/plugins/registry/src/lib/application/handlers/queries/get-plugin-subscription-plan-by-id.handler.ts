import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionPlanService } from '../../../domain/services/plugin-subscription-plan.service';
import { IPluginSubscriptionPlan } from '../../../shared/models/plugin-subscription.model';
import { GetPluginSubscriptionPlanByIdQuery } from '../../queries/get-plugin-subscription-plan-by-id.query';

@QueryHandler(GetPluginSubscriptionPlanByIdQuery)
export class GetPluginSubscriptionPlanByIdQueryHandler implements IQueryHandler<GetPluginSubscriptionPlanByIdQuery> {
	constructor(private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService) {}

	async execute(query: GetPluginSubscriptionPlanByIdQuery): Promise<IPluginSubscriptionPlan> {
		const { id, relations } = query;

		try {
			return await this.pluginSubscriptionPlanService.getPlanById(id, relations);
		} catch (error) {
			throw new BadRequestException(`Failed to get plugin subscription plan: ${error.message}`);
		}
	}
}
