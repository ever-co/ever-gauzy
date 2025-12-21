import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSettingService } from '../../../../domain';
import { IPluginSetting } from '../../../../shared';
import { GetPluginSettingsByPluginIdQuery } from '../get-plugin-settings-by-plugin-id.query';

@QueryHandler(GetPluginSettingsByPluginIdQuery)
export class GetPluginSettingsByPluginIdHandler implements IQueryHandler<GetPluginSettingsByPluginIdQuery> {
	constructor(private readonly pluginSettingService: PluginSettingService) {}

	async execute(query: GetPluginSettingsByPluginIdQuery): Promise<IPluginSetting[]> {
		const { pluginId, relations, tenantId, organizationId } = query;

		try {
			if (!pluginId) {
				throw new BadRequestException('Plugin ID is required');
			}

			let settings = await this.pluginSettingService.findByPluginId(
				pluginId,
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
			throw new BadRequestException(`Failed to get plugin settings by plugin ID: ${error.message}`);
		}
	}
}
