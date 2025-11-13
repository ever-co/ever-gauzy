import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class GetPluginSettingByIdQuery implements IQuery {
	public static readonly type = '[Plugin Setting] Get By ID';

	constructor(
		public readonly id: ID,
		public readonly relations?: string[],
		public readonly tenantId?: ID,
		public readonly organizationId?: ID
	) {}
}
