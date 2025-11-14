import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginTenantService } from '../../../../domain';
import { GetPluginTenantsByPluginQuery } from '../get-plugin-tenants-by-plugin.query';
import { IPluginTenant } from '../../../../shared';

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
	public async execute(query: GetPluginTenantsByPluginQuery): Promise<IPluginTenant[]> {
		const { pluginId } = query;

		if (!pluginId) {
			throw new BadRequestException('Plugin ID is required');
		}

		return await this.pluginTenantService.findByPluginId(pluginId, [
			'plugin',
			'approvedBy',
			'allowedRoles',
			'allowedUsers',
			'deniedUsers'
		]);
	}
}
