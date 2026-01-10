import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginTenant, PluginTenantService } from '../../../../domain';
import { IPluginTenantAccessCheckResult } from '../../../../shared';
import { CheckPluginTenantAccessQuery } from '../check-plugin-tenant-access.query';

@QueryHandler(CheckPluginTenantAccessQuery)
export class CheckPluginTenantAccessHandler implements IQueryHandler<CheckPluginTenantAccessQuery> {
	constructor(private readonly pluginTenantService: PluginTenantService) {}

	/**
	 * Executes the check plugin tenant access query
	 *
	 * @param query - The query containing user and plugin access check data
	 * @returns Access check result with plugin tenant if access is granted
	 * @throws BadRequestException if required parameters are missing
	 */
	public async execute(query: CheckPluginTenantAccessQuery): Promise<IPluginTenantAccessCheckResult> {
		const { userId, pluginId, userRoles, tenantId, organizationId } = query;

		if (!userId || !pluginId || !userRoles) {
			throw new BadRequestException('User ID, Plugin ID, and user roles are required');
		}

		// Find plugin tenant relationship
		const pluginTenant = await this.pluginTenantService.findByPluginAndTenant(pluginId, tenantId, organizationId);

		if (!pluginTenant) {
			return {
				hasAccess: false,
				denialReason: 'Plugin is not installed for this tenant/organization'
			};
		}

		// Convert to entity to use business logic methods
		const entity = Object.assign(new PluginTenant(), pluginTenant);

		// Check if plugin is available
		if (!entity.isAvailable()) {
			return {
				hasAccess: false,
				denialReason: 'Plugin is not available (disabled or archived)'
			};
		}

		// Check user access using business logic
		const hasAccess = entity.hasUserAccess(userId, userRoles);

		if (!hasAccess) {
			return {
				hasAccess: false,
				denialReason: 'User does not have permission to access this plugin'
			};
		}

		// Access granted
		return {
			hasAccess: true,
			pluginTenant: pluginTenant
		};
	}
}
