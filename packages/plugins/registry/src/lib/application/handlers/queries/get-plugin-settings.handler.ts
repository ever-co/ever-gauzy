import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { GetPluginSettingsQuery } from '../../queries/get-plugin-settings.query';
import { PluginSettingService } from '../../services/plugin-setting.service';
import { IPluginSetting } from '../../../shared/models/plugin-setting.model';
import { IPagination } from '@gauzy/contracts';

@QueryHandler(GetPluginSettingsQuery)
export class GetPluginSettingsHandler implements IQueryHandler<GetPluginSettingsQuery> {
	constructor(private readonly pluginSettingService: PluginSettingService) {}

	async execute(query: GetPluginSettingsQuery): Promise<IPagination<IPluginSetting>> {
		const { options, tenantId, organizationId } = query;

		try {
			// Add tenant context to query options
			const queryOptions = {
				...options,
				where: {
					...options?.where,
					...(tenantId && { tenantId }),
					...(organizationId && { organizationId })
				},
				relations: options?.relations || ['plugin', 'pluginTenant']
			};

			return await this.pluginSettingService.findAll(queryOptions);
		} catch (error) {
			throw new BadRequestException(`Failed to get plugin settings: ${error.message}`);
		}
	}
}
