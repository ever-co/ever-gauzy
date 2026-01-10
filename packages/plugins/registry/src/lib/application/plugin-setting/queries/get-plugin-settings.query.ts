import { IQuery } from '@nestjs/cqrs';
import { FindManyOptions } from 'typeorm';
import { IPluginSetting } from '../../../shared';

export class GetPluginSettingsQuery implements IQuery {
	public static readonly type = '[Plugin Setting] Get Settings';

	constructor(
		public readonly options?: FindManyOptions<IPluginSetting>,
		public readonly tenantId?: string,
		public readonly organizationId?: string
	) {}
}
