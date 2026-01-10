import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';
import { PluginAccessCheckDTO } from '../../../shared';

export class CheckPluginAccessQuery implements IQuery {
	public static readonly type = '[Plugin Subscription] Check Access';

	constructor(
		public readonly accessCheckDto: PluginAccessCheckDTO,
		public readonly tenantId: ID,
		public readonly organizationId?: ID
	) {}
}
