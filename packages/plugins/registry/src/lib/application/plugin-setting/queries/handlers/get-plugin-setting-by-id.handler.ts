import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSettingService } from '../../../../domain';
import { IPluginSetting } from '../../../../shared';
import { GetPluginSettingByIdQuery } from '../get-plugin-setting-by-id.query';

@QueryHandler(GetPluginSettingByIdQuery)
export class GetPluginSettingByIdHandler implements IQueryHandler<GetPluginSettingByIdQuery> {
	constructor(private readonly pluginSettingService: PluginSettingService) {}

	async execute(query: GetPluginSettingByIdQuery): Promise<IPluginSetting> {
		const { id, relations, tenantId, organizationId } = query;

		try {
			const pluginSetting = await this.pluginSettingService.findOneByIdString(id, {
				relations: relations || ['plugin', 'pluginTenant']
			});

			if (!pluginSetting) {
				throw new NotFoundException(`Plugin setting with ID "${id}" not found`);
			}

			// Verify tenant access
			if (tenantId && pluginSetting.tenantId !== tenantId) {
				throw new BadRequestException('Access denied to this plugin setting');
			}

			// Verify organization access
			if (organizationId && pluginSetting.organizationId !== organizationId) {
				throw new BadRequestException('Access denied to this plugin setting');
			}

			return pluginSetting;
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to get plugin setting: ${error.message}`);
		}
	}
}
