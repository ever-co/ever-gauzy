import { IQuery } from '@nestjs/cqrs';
import { FindManyOptions } from 'typeorm';
import { PluginSetting } from '../../domain/entities/plugin-setting.entity';

export class GetPluginSettingsQuery implements IQuery {
	public static readonly type = '[Plugin Setting] Get Settings';

	constructor(
		public readonly options?: FindManyOptions<PluginSetting>,
		public readonly tenantId?: string,
		public readonly organizationId?: string
	) {}
}
