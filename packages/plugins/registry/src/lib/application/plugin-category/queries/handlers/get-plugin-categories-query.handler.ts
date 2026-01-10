import { IPagination } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginCategoryService } from '../../../../domain';
import { IPluginCategory } from '../../../../shared';
import { GetPluginCategoriesQuery } from '../get-plugin-categories.query';

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
