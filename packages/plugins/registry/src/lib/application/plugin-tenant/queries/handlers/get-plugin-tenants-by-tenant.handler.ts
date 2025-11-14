import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginTenantService } from '../../../../domain';
import { IPluginTenant } from '../../../../shared';
import { GetPluginTenantsByTenantQuery } from '../get-plugin-tenants-by-tenant.query';

@QueryHandler(GetPluginTenantsByTenantQuery)
export class GetPluginTenantsByTenantHandler implements IQueryHandler<GetPluginTenantsByTenantQuery> {
	constructor(private readonly pluginTenantService: PluginTenantService) {}

	/**
	 * Executes the get plugin tenants by tenant query
	 *
	 * @param query - The query containing tenant ID and optional organization ID
	 * @returns Array of plugin tenants for the specified tenant/organization
	 * @throws BadRequestException if tenant ID is invalid
	 */
	public async execute(query: GetPluginTenantsByTenantQuery): Promise<IPluginTenant[]> {
		const { tenantId, organizationId } = query;

		if (!tenantId) {
			throw new BadRequestException('Tenant ID is required');
		}

		return await this.pluginTenantService.findByTenantId(tenantId, organizationId, [
			'plugin',
			'approvedBy',
			'allowedRoles',
			'allowedUsers',
			'deniedUsers'
		]);
	}
}
