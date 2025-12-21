import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class GetPluginCategoryQuery implements IQuery {
	static readonly type = '[Plugin Category] Get Category';

	constructor(public readonly id: ID, public readonly relations?: string[]) {}
}
