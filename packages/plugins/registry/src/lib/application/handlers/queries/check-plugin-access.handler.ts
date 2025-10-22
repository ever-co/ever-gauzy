import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../domain/services';
import { IPluginSubscription } from '../../../shared/models';
import { CheckPluginAccessQuery } from '../../queries';

@QueryHandler(CheckPluginAccessQuery)
export class CheckPluginAccessQueryHandler implements IQueryHandler<CheckPluginAccessQuery> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(query: CheckPluginAccessQuery): Promise<{ hasAccess: boolean; subscription?: IPluginSubscription }> {
		const { accessCheckDto, tenantId, organizationId } = query;

		try {
			const hasAccess = await this.pluginSubscriptionService.hasPluginAccess(
				accessCheckDto.pluginId,
				tenantId,
				organizationId,
				accessCheckDto.subscriberId
			);

			let subscription = null;
			if (hasAccess) {
				subscription = await this.pluginSubscriptionService.findActiveSubscription(
					accessCheckDto.pluginId,
					tenantId,
					organizationId,
					accessCheckDto.subscriberId
				);
			}

			return { hasAccess, subscription };
		} catch (error) {
			throw new BadRequestException(`Failed to check plugin access: ${error.message}`);
		}
	}
}
