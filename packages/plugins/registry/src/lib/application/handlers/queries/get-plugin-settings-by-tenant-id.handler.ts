import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { GetPluginSettingsByTenantIdQuery } from '../../queries/get-plugin-settings-by-tenant-id.query';
import { PluginSettingService } from '../../../domain/services/plugin-setting.service';
import { IPluginSetting } from '../../../shared/models/plugin-setting.model';

@QueryHandler(GetPluginSettingsByTenantIdQuery)
export class GetPluginSettingsByTenantIdHandler implements IQueryHandler<GetPluginSettingsByTenantIdQuery> {
	constructor(private readonly pluginSettingService: PluginSettingService) {}

	async execute(query: GetPluginSettingsByTenantIdQuery): Promise<IPluginSetting[]> {
		const { pluginTenantId, relations, tenantId, organizationId } = query;

		try {
			if (!pluginTenantId) {
				throw new BadRequestException('Plugin tenant ID is required');
			}

			let settings = await this.pluginSettingService.findByPluginTenantId(
				pluginTenantId,
				relations || ['plugin', 'pluginTenant']
			);

			// Filter by tenant if provided
			if (tenantId) {
				settings = settings.filter((setting) => setting.tenantId === tenantId);
			}

			// Filter by organization if provided
			if (organizationId) {
				settings = settings.filter((setting) => setting.organizationId === organizationId);
			}

			return settings;
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to get plugin settings by tenant ID: ${error.message}`);
		}
	}
}
