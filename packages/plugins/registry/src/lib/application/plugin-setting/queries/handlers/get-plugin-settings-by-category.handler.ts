import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSettingService } from '../../../../domain';
import { IPluginSetting } from '../../../../shared';
import { GetPluginSettingsByCategoryQuery } from '../get-plugin-settings-by-category.query';

@QueryHandler(GetPluginSettingsByCategoryQuery)
export class GetPluginSettingsByCategoryHandler implements IQueryHandler<GetPluginSettingsByCategoryQuery> {
	constructor(private readonly pluginSettingService: PluginSettingService) {}

	async execute(query: GetPluginSettingsByCategoryQuery): Promise<IPluginSetting[]> {
		const { pluginId, categoryId, pluginTenantId, relations, tenantId, organizationId } = query;

		try {
			if (!pluginId || !categoryId) {
				throw new BadRequestException('Plugin ID and category are required');
			}

			let settings = await this.pluginSettingService.findByCategory(
				pluginId,
				categoryId,
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
			throw new BadRequestException(`Failed to get plugin settings by category: ${error.message}`);
		}
	}
}
