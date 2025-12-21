import { RequestContext } from '@gauzy/core';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindManyOptions, FindOptionsWhere } from 'typeorm';
import { PluginTenant, PluginTenantService } from '../../../../domain';
import { IPluginTenant } from '../../../../shared';
import { GetAllPluginTenantsQuery } from '../get-all-plugin-tenants.query';

@QueryHandler(GetAllPluginTenantsQuery)
export class GetAllPluginTenantsHandler implements IQueryHandler<GetAllPluginTenantsQuery> {
	constructor(private readonly pluginTenantService: PluginTenantService) {}

	/**
	 * Executes the get all plugin tenants query
	 *
	 * @param query - The query containing optional filters
	 * @returns Array of plugin tenants matching the criteria
	 */
	public async execute(query: GetAllPluginTenantsQuery): Promise<IPluginTenant[]> {
		const { filter } = query;

		// Build the where clause based on filters
		const where: FindOptionsWhere<PluginTenant> = {};

		// Add context-based filters
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		if (tenantId) {
			where.tenantId = tenantId;
		}

		if (organizationId) {
			where.organizationId = organizationId;
		}

		// Apply user-provided filters
		if (filter) {
			if (filter.pluginId) {
				where.pluginId = filter.pluginId;
			}
			if (filter.tenantId) {
				where.tenantId = filter.tenantId;
			}
			if (filter.organizationId) {
				where.organizationId = filter.organizationId;
			}
			if (typeof filter.enabled === 'boolean') {
				where.enabled = filter.enabled;
			}
			if (filter.scope) {
				where.scope = filter.scope;
			}
			if (typeof filter.isMandatory === 'boolean') {
				where.isMandatory = filter.isMandatory;
			}
			if (typeof filter.isDataCompliant === 'boolean') {
				where.isDataCompliant = filter.isDataCompliant;
			}
			// Handle isApproved filter - need to check if approvedAt is not null
			if (typeof filter.isApproved === 'boolean') {
				if (filter.isApproved) {
					// Use raw query builder for complex conditions if needed
					// For now, we'll handle this in the service layer or use a more complex query
					// TODO: Implement complex filtering in service if required
				}
			}
		}

		const options: FindManyOptions = {
			where,
			relations: ['plugin', 'approvedBy', 'allowedRoles', 'allowedUsers', 'deniedUsers'],
			order: { createdAt: 'DESC' }
		};

		const result = await this.pluginTenantService.findAll(options);
		return result.items || [];
	}
}
