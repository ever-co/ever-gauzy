import { IQuery } from '@nestjs/cqrs';

export class GetPluginCategoryQuery implements IQuery {
	static readonly type = '[Plugin Category] Get Category';

	constructor(public readonly id: string, public readonly relations?: string[]) {}
}
