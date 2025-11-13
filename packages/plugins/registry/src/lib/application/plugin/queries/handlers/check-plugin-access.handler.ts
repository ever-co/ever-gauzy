import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSubscriptionAccessService } from '../../../domain/services/plugin-subscription-access.service';
import { IPluginSubscription } from '../../../shared/models';
import { CheckPluginAccessQuery } from '../../queries';

@QueryHandler(CheckPluginAccessQuery)
export class CheckPluginAccessQueryHandler implements IQueryHandler<CheckPluginAccessQuery> {
	constructor(private readonly pluginSubscriptionAccessService: PluginSubscriptionAccessService) {}

	async execute(query: CheckPluginAccessQuery): Promise<{ hasAccess: boolean; subscription?: IPluginSubscription }> {
		const { accessCheckDto, tenantId, organizationId } = query;

		try {
			// Use centralized subscription access service
			const hasAccess = await this.pluginSubscriptionAccessService.validatePluginAccess(
				accessCheckDto.pluginId,
				tenantId,
				organizationId,
				accessCheckDto.subscriberId
			);

			let subscription = null;
			if (hasAccess) {
				subscription = await this.pluginSubscriptionAccessService.findApplicableSubscription(
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
