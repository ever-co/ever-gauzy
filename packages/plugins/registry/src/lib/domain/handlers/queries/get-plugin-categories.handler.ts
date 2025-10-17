import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetPluginCategoriesQuery } from '../../queries/get-plugin-categories.query';
import { PluginCategoryService } from '../../services/plugin-category.service';
import { IPluginCategory } from '../../../shared/models';
import { IPagination } from '@gauzy/contracts';

@QueryHandler(GetPluginCategoriesQuery)
export class GetPluginCategoriesHandler implements IQueryHandler<GetPluginCategoriesQuery> {
	constructor(private readonly pluginCategoryService: PluginCategoryService) {}

	async execute(query: GetPluginCategoriesQuery): Promise<IPagination<IPluginCategory>> {
		const { options } = query;

		try {
			return await this.pluginCategoryService.findAll(options);
		} catch (error) {
			throw new Error(`Failed to get plugin categories: ${error.message}`);
		}
	}
}
