import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSettingService } from '../../../../domain';
import { GetPluginSettingValueQuery } from '../get-plugin-setting-value.query';

@QueryHandler(GetPluginSettingValueQuery)
export class GetPluginSettingValueHandler implements IQueryHandler<GetPluginSettingValueQuery> {
	constructor(private readonly pluginSettingService: PluginSettingService) {}

	async execute(query: GetPluginSettingValueQuery): Promise<any> {
		const { pluginId, key, pluginTenantId, tenantId, organizationId } = query;

		try {
			if (!pluginId || !key) {
				throw new BadRequestException('Plugin ID and key are required');
			}

			const setting = await this.pluginSettingService.findByKey(pluginId, key, pluginTenantId);

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

			return setting.value;
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to get plugin setting value: ${error.message}`);
		}
	}
}
