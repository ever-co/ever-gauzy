import { ID } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { In } from 'typeorm';
import { PluginTenantService } from '../../../../domain/services/plugin-tenant.service';
import { GetPluginTenantByPluginQuery } from '../get-plugin-tenant-by-plugin.query';

@QueryHandler(GetPluginTenantByPluginQuery)
export class GetPluginTenantByPluginHandler implements IQueryHandler<GetPluginTenantByPluginQuery> {
	constructor(private readonly pluginTenantService: PluginTenantService) {}

	/**
	 * Executes the query to get a plugin tenant by plugin ID
	 * If the plugin tenant doesn't exist, it will be created
	 *
	 * @param query - The query containing pluginId, tenantId, and optional organizationId
	 * @returns Object with id and pluginId
	 */
	async execute(query: GetPluginTenantByPluginQuery): Promise<{ id: ID; pluginId: ID }> {
		const { pluginId, tenantId, organizationId } = query;
		const subscriberId = RequestContext.currentUserId();

		//Add validation
		if (!pluginId) {
			throw new BadRequestException('Plugin ID is required');
		}

		if (!tenantId) {
			throw new BadRequestException('Tenant ID is required');
		}

		if (!subscriberId) {
			throw new BadRequestException('Subscriber ID is required from the request context');
		}

		try {
			// Find the plugin tenant
			const pluginTenant = await this.pluginTenantService.findOneByWhereOptions({
				pluginId,
				tenantId,
				organizationId,
				allowedUsers: {
					id: In([subscriberId])
				}
			});

			return {
				id: pluginTenant.id,
				pluginId
			};
		} catch (error) {
			throw new BadRequestException(`Failed to get plugin tenant for plugin ${pluginId}: ${error.message}`);
		}
	}
}
