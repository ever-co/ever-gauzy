import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSettingService } from '../../../../domain';
import { IPluginSetting } from '../../../../shared';
import { GetPluginSettingsByKeyQuery } from '../get-plugin-setting-by-key.query';

@QueryHandler(GetPluginSettingsByKeyQuery)
export class GetPluginSettingByKeyHandler implements IQueryHandler<GetPluginSettingsByKeyQuery> {
	constructor(private readonly pluginSettingService: PluginSettingService) {}

	async execute(query: GetPluginSettingsByKeyQuery): Promise<IPluginSetting | null> {
		const { pluginId, key, pluginTenantId, relations, tenantId, organizationId } = query;

		try {
			if (!pluginId || !key) {
				throw new BadRequestException('Plugin ID and key are required');
			}

			const setting = await this.pluginSettingService.findByKey(
				pluginId,
				key,
				pluginTenantId,
				relations || ['plugin', 'pluginTenant']
			);

			if (!setting) {
				return null;
			}

			// Verify tenant access
			if (tenantId && setting.tenantId !== tenantId) {
				throw new BadRequestException('Access denied to this plugin setting');
			}

			// Verify organization access
			if (organizationId && setting.organizationId !== organizationId) {
				throw new BadRequestException('Access denied to this plugin setting');
			}

			return setting;
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to get plugin setting by key: ${error.message}`);
		}
	}
}
