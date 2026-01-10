import { IQuery } from '@nestjs/cqrs';
import { FindManyOptions } from 'typeorm';
import { PluginCategory } from '../../../domain';

export class GetPluginCategoriesQuery implements IQuery {
	static readonly type = '[Plugin Category] Get Categories';

	constructor(public readonly options?: FindManyOptions<PluginCategory>) {}
}
