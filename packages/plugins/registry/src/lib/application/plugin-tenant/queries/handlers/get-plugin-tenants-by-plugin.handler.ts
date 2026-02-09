import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IPagination } from '@gauzy/contracts';
import { PluginTenantService } from '../../../../domain';
import { IPluginTenant } from '../../../../shared';
import { GetPluginTenantsByPluginQuery } from '../get-plugin-tenants-by-plugin.query';

@QueryHandler(GetPluginTenantsByPluginQuery)
export class GetPluginTenantsByPluginHandler implements IQueryHandler<GetPluginTenantsByPluginQuery> {
	constructor(private readonly pluginTenantService: PluginTenantService) {}

	/**
	 * Executes the get plugin tenants by plugin query
	 *
	 * @param query - The query containing plugin ID
	 * @returns Array of plugin tenants for the specified plugin
	 * @throws BadRequestException if plugin ID is invalid
	 */
	public async execute(query: GetPluginTenantsByPluginQuery): Promise<IPagination<IPluginTenant>> {
		const { pluginId, skip, take } = query;

		if (!pluginId) {
			throw new BadRequestException('Plugin ID is required');
		}

		return this.pluginTenantService.findByPluginId(
			pluginId,
			['plugin', 'approvedBy', 'allowedRoles', 'allowedUsers', 'deniedUsers'],
			skip,
			take
		);
	}
}
