import { IQueryHandler } from '@nestjs/cqrs';
import { PluginCategoryService } from '../../../../domain';
import { IPluginCategoryTree } from '../../../../shared';
import { GetPluginCategoryTreeQuery } from '../get-plugin-category-tree.query';

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
