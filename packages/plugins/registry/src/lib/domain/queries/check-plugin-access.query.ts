import { IQuery } from '@nestjs/cqrs';
import { PluginAccessCheckDTO } from '../../shared/dto/plugin-subscription.dto';

export class CheckPluginAccessQuery implements IQuery {
	public static readonly type = '[Plugin Subscription] Check Access';

	constructor(
		public readonly accessCheckDto: PluginAccessCheckDTO,
		public readonly tenantId: string,
		public readonly organizationId?: string
	) {}
}
