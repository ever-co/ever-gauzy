import { IQuery } from '@nestjs/cqrs';
import { IPluginCategoryFindInput } from '../../../shared';

export class GetPluginCategoryTreeQuery implements IQuery {
	static readonly type = '[Plugin Category] Get Category Tree';

	constructor(public readonly options?: IPluginCategoryFindInput) {}
}
