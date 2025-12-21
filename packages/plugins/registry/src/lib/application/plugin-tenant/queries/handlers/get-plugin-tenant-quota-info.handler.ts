import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginTenant, PluginTenantService } from '../../../../domain';
import { IPluginTenantQuotaInfo } from '../../../../shared';
import { GetPluginTenantQuotaInfoQuery } from '../get-plugin-tenant-quota-info.query';

@QueryHandler(GetPluginTenantQuotaInfoQuery)
export class GetPluginTenantQuotaInfoHandler implements IQueryHandler<GetPluginTenantQuotaInfoQuery> {
	constructor(private readonly pluginTenantService: PluginTenantService) {}

	/**
	 * Executes the get plugin tenant quota info query
	 *
	 * @param query - The query containing plugin tenant ID
	 * @returns Quota information for the plugin tenant
	 * @throws BadRequestException if plugin tenant ID is missing
	 * @throws NotFoundException if plugin tenant not found
	 */
	public async execute(query: GetPluginTenantQuotaInfoQuery): Promise<IPluginTenantQuotaInfo> {
		const { pluginTenantId } = query;

		if (!pluginTenantId) {
			throw new BadRequestException('Plugin tenant ID is required');
		}

		// Find plugin tenant
		const pluginTenant = await this.pluginTenantService.findOneByIdString(pluginTenantId);
		if (!pluginTenant) {
			throw new NotFoundException(`Plugin tenant with ID "${pluginTenantId}" not found`);
		}

		// Convert to entity to use business logic methods
		const entity = Object.assign(new PluginTenant(), pluginTenant);

		// Build quota info using business logic
		const quotaInfo: IPluginTenantQuotaInfo = {
			maxInstallations: entity.maxInstallations,
			currentInstallations: entity.currentInstallations || 0,
			canInstallMore: entity.canInstallMore(),
			installationUtilization: entity.installationUtilization || 0,
			maxActiveUsers: entity.maxActiveUsers,
			currentActiveUsers: entity.currentActiveUsers || 0,
			canAddMoreUsers: entity.canAddMoreUsers(),
			userUtilization: entity.userUtilization || 0,
			isQuotaExceeded: entity.isQuotaExceeded || false
		};

		return quotaInfo;
	}
}
