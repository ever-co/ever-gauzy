import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class GetPluginTenantByIdQuery implements IQuery {
	public static readonly type = '[Plugin Tenant] Get By Id';

	constructor(public readonly id: ID) {}
}
