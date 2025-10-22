import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetPluginCategoryTreeQuery } from '../../queries/get-plugin-category-tree.query';
import { PluginCategoryService } from '../../../domain/services/plugin-category.service';
import { IPluginCategoryTree } from '../../../shared/models';

@QueryHandler(GetPluginCategoryTreeQuery)
export class GetPluginCategoryTreeHandler implements IQueryHandler<GetPluginCategoryTreeQuery> {
	constructor(private readonly pluginCategoryService: PluginCategoryService) {}

	async execute(query: GetPluginCategoryTreeQuery): Promise<IPluginCategoryTree[]> {
		const { options } = query;

		try {
			return await this.pluginCategoryService.getTree(options);
		} catch (error) {
			throw new Error(`Failed to get plugin category tree: ${error.message}`);
		}
	}
}
