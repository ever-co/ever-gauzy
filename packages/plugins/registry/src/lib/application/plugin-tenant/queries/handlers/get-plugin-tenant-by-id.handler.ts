import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginTenantService } from '../../../../domain';
import { IPluginTenant } from '../../../../shared';
import { GetPluginTenantByIdQuery } from '../get-plugin-tenant-by-id.query';

@QueryHandler(GetPluginTenantByIdQuery)
export class GetPluginTenantByIdHandler implements IQueryHandler<GetPluginTenantByIdQuery> {
	constructor(private readonly pluginTenantService: PluginTenantService) {}

	/**
	 * Executes the get plugin tenant by ID query
	 *
	 * @param query - The query containing plugin tenant ID
	 * @returns The plugin tenant with full relations
	 * @throws NotFoundException if plugin tenant not found
	 */
	public async execute(query: GetPluginTenantByIdQuery): Promise<IPluginTenant> {
		const { id } = query;

		const pluginTenant = await this.pluginTenantService.findOneByIdString(id, {
			relations: [
				'plugin',
				'approvedBy',
				'allowedRoles',
				'allowedUsers',
				'deniedUsers',
				'settings',
				'subscriptions'
			]
		});

		if (!pluginTenant) {
			throw new NotFoundException(`Plugin tenant with ID "${id}" not found`);
		}

		return pluginTenant;
	}
}
