import { IPagination } from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginSettingService } from '../../../../domain';
import { IPluginSetting } from '../../../../shared';
import { GetPluginSettingsQuery } from '../get-plugin-settings.query';

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
