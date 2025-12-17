import { PluginScope } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindOptionsWhere } from 'typeorm';
import { PluginTenant, PluginTenantService } from '../../../../domain';
import { IPluginTenantStatistics } from '../../../../shared';
import { GetPluginTenantStatisticsQuery } from '../get-plugin-tenant-statistics.query';

@QueryHandler(GetPluginTenantStatisticsQuery)
export class GetPluginTenantStatisticsHandler implements IQueryHandler<GetPluginTenantStatisticsQuery> {
	constructor(private readonly pluginTenantService: PluginTenantService) {}

	/**
	 * Executes the get plugin tenant statistics query
	 *
	 * @param query - The query containing optional tenant and organization filters
	 * @returns Statistics about plugin tenant usage
	 */
	public async execute(query: GetPluginTenantStatisticsQuery): Promise<IPluginTenantStatistics> {
		const { tenantId, organizationId } = query;

		// Use context if no explicit tenant provided
		const contextTenantId = tenantId || RequestContext.currentTenantId();
		const contextOrgId = organizationId || RequestContext.currentOrganizationId();

		// Build base where clause
		const where: FindOptionsWhere<PluginTenant> = {};
		if (contextTenantId) {
			where.tenantId = contextTenantId;
		}
		if (contextOrgId) {
			where.organizationId = contextOrgId;
		}

		// Get all plugin tenants matching criteria
		const result = await this.pluginTenantService.findAll({ where });
		const pluginTenants = result.items || [];

		// Calculate statistics
		const statistics: IPluginTenantStatistics = {
			totalPluginTenants: pluginTenants.length,
			enabledCount: pluginTenants.filter((pt) => pt.enabled).length,
			disabledCount: pluginTenants.filter((pt) => !pt.enabled).length,
			approvedCount: pluginTenants.filter((pt) => pt.approvedAt !== null && pt.approvedAt !== undefined).length,
			pendingApprovalCount: pluginTenants.filter(
				(pt) => pt.requiresApproval && (!pt.approvedAt || pt.approvedAt === null)
			).length,
			totalInstallations: pluginTenants.reduce((sum, pt) => sum + (pt.currentInstallations || 0), 0),
			totalActiveUsers: pluginTenants.reduce((sum, pt) => sum + (pt.currentActiveUsers || 0), 0),
			quotaExceededCount: 0, // We'll calculate this
			byScope: {
				[PluginScope.USER]: 0,
				[PluginScope.ORGANIZATION]: 0,
				[PluginScope.TENANT]: 0
			}
		};

		// Calculate quota exceeded and scope breakdown
		for (const pluginTenant of pluginTenants) {
			// Check if quota is exceeded
			const maxInstallations = pluginTenant.maxInstallations;
			const maxActiveUsers = pluginTenant.maxActiveUsers;
			const currentInstallations = pluginTenant.currentInstallations || 0;
			const currentActiveUsers = pluginTenant.currentActiveUsers || 0;

			const isInstallationQuotaExceeded =
				maxInstallations !== null &&
				maxInstallations !== undefined &&
				maxInstallations !== -1 &&
				currentInstallations > maxInstallations;

			const isUserQuotaExceeded =
				maxActiveUsers !== null &&
				maxActiveUsers !== undefined &&
				maxActiveUsers !== -1 &&
				currentActiveUsers > maxActiveUsers;

			if (isInstallationQuotaExceeded || isUserQuotaExceeded) {
				statistics.quotaExceededCount++;
			}

			// Count by scope
			if (pluginTenant.scope in statistics.byScope) {
				statistics.byScope[pluginTenant.scope]++;
			}
		}

		return statistics;
	}
}
