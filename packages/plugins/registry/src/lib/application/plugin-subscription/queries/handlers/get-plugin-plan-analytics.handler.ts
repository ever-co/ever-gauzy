import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionPlanService } from '../../../../domain';
import { GetPluginPlanAnalyticsQuery } from '../get-plugin-plan-analytics.query';

@QueryHandler(GetPluginPlanAnalyticsQuery)
export class GetPluginPlanAnalyticsQueryHandler implements IQueryHandler<GetPluginPlanAnalyticsQuery> {
	constructor(private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService) {}

	async execute(query: GetPluginPlanAnalyticsQuery): Promise<{
		totalSubscriptions: number;
		activeSubscriptions: number;
		revenue: number;
		conversionRate: number;
	}> {
		const { analyticsDto } = query;

		try {
			const dateFrom = analyticsDto.dateFrom ? new Date(analyticsDto.dateFrom) : undefined;
			const dateTo = analyticsDto.dateTo ? new Date(analyticsDto.dateTo) : undefined;

			return await this.pluginSubscriptionPlanService.getPlanAnalytics(analyticsDto.planId, dateFrom, dateTo);
		} catch (error) {
			throw new BadRequestException(`Failed to get plugin plan analytics: ${error.message}`);
		}
	}
}
